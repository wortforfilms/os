# Kernel clock

`src/clock.rs` gives the kernel a **monotonic clock since boot**. It closes the "no clock" gap for anything inside the kernel that needs durations or ordering: pacing the scheduler, timeouts, and comparing kernel events. It is **not a trusted clock**. Nothing calibrates the oscillator, and the clock knows nothing about wall time.

## Design

| Choice | Value | Why |
| --- | --- | --- |
| Source | SysTick, `SystClkSource::Core` | Present on every Cortex-M. QEMU's external reference clock for this board isn't something to rely on. |
| Core clock | 168 MHz (`CORE_CLOCK_HZ`) | STM32F405, as QEMU `netduinoplus2` models it. On hardware, set it from the clock tree, here only. |
| Tick | 1 kHz, `RELOAD = 168_000_000 / 1_000 − 1 = 167_999` | The counter runs RELOAD..=0, so a tick is RELOAD + 1 cycles. The 24-bit limit is about 99.9 ms at 168 MHz. |
| Counter | `u64` in `cortex_m::interrupt::Mutex<Cell<_>>` | ARMv7-M and ARMv7E-M have no 64-bit atomics, so `AtomicU64` does not exist on `thumbv7(e)m`. The ISR is the only writer, and readers mask interrupts for a few cycles. |
| Reading | `ticks × 1 ms + (RELOAD − SYST_CVR)` cycles | Precise to one cycle, not just one tick. |
| Missed wrap | If `PENDSTSET` is set, count that tick and re-read `SYST_CVR` | Covers a wrap the ISR hasn't run for yet. A second wrap while still masked is lost, so keep critical sections well under 1 ms. |
| Never backwards | Clamp to the last reading and count it (`regressions()`) | Expected to stay 0. The boot report prints it. |
| Handler | `#[exception] fn SysTick` in each binary, calling `clock::on_systick()` | If the handler lived only in the library, the linker could keep the default handler instead. |

## Hemant time

Uptime alone is not Hemant time, because it starts at zero at every boot:

```
hemant_ns_since_epoch = (host_unix_seconds × 10⁹ − HEMANT_SAMWAT_EPOCH_NANOS)
                      + (uptime_now − uptime_at_anchor)
```

`HostAnchor` reads the host clock once over semihosting (`SYS_TIME`). The result is labelled `host-unix-clock-unverified`, the same label the rest of MAATAA uses, because the host clock is still unverified. The monotonic part (`kernel-monotonic-since-boot`) does replace host time for durations and ordering inside the kernel.

## Boot report

```
clock: systick 1000 Hz, core 168000000 Hz (board assumption)
time: kernel-monotonic-since-boot
uptime ns: <n>
hemant anchor: host-unix-clock-unverified
hemant ns since epoch: <n>
hemant position: ahoratra <n> muhurta <n> kala <n> kastha <n> nimesha <n>
…
tick <n>
  uptime ns: <n>
…
clock regressions: 0
uptime at exit ns: <n>
```

The scheduler loop now sleeps 10 ms of kernel time between ticks, with `WFI` while it waits. Before, it ran a cycle-count busy loop. The `tick N` lines are still a simulation counter, and the uptime lines beneath them are the real kernel time.

The line `verification certified` is now `verification self-check passed`. The check compares against an embedded reference using a built-in "nominal" gap state, so it is not certification by anyone outside the kernel.

## Testing

`./scripts/qemu-clock-test.sh` runs `src/bin/clock_selftest.rs` in QEMU. It checks that the clock:

- starts at 0,
- advances at least 50 ticks during a 50 ms sleep,
- never goes backwards across 200,000 reads,
- counts a wrap that is still pending while interrupts are masked,
- runs at 80–125% of host wall time over 2 s (observed: 99%),
- produces Hemant time as anchor plus uptime.

QEMU gotchas:

- QEMU does not model cycles exactly. Assert ranges, never exact counts.
- Use `SYS_ELAPSED` / `SYS_TICKFREQ` as the reference. Do not use `SYS_CLOCK`: QEMU answers it with the host process's **CPU time**, which barely moves while the guest sleeps in `WFI`. With `SYS_CLOCK` the kernel clock looked 14 times faster than the host.
- `cargo test --lib` (`scripts/test-host.sh`) covers the pure arithmetic: the reload math, sub-tick nanoseconds, monotonicity across tick boundaries, saturation, and the anchor formula.

## Still open

- Trust: a drift reference (RTC plus an external time source) and a signed anchor.
- A request/response channel to the host. The report is still printed once at boot, and then QEMU exits.
- A preemptive scheduler and IPC timeouts driven by this clock.
