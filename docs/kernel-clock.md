# Kernel clock

`src/clock.rs` gives the kernel a **monotonic clock since boot**. It closes the "no clock" gap for anything inside the kernel that needs durations or ordering: pacing the scheduler, timeouts, and comparing kernel events. It is **not a trusted clock**. Nothing calibrates the oscillator, and the clock knows nothing about wall time.

## Design

| Choice | Value | Why |
| --- | --- | --- |
| Source | SysTick, `SystClkSource::Core` | Present on every Cortex-M. QEMU's external reference clock for this board isn't something to rely on. |
| Core clock | From the board at start-up (`src/board.rs`) | QEMU: fixed 168 MHz. F411: whatever RCC was configured to (100 MHz). Nothing else in the kernel assumes a frequency. |
| Tick | 1 kHz, `reload = core_hz / 1_000 − 1` (`Config::for_core_hz`) | 167_999 at 168 MHz, 99_999 at 100 MHz, 15_999 at the F411's 16 MHz reset clock. A tick is reload + 1 cycles. Frequencies that are not a whole number of cycles per tick are refused. |
| Counter | `u64` in `cortex_m::interrupt::Mutex<Cell<_>>` | ARMv7-M and ARMv7E-M have no 64-bit atomics, so `AtomicU64` does not exist on `thumbv7(e)m`. The ISR is the only writer, and readers mask interrupts for a few cycles. |
| Reading | `ticks × 1 ms + (reload − SYST_CVR)` cycles | Precise to one cycle, not just one tick. |
| Missed wrap | If `PENDSTSET` is set, count that tick and re-read `SYST_CVR` | Covers a wrap the ISR hasn't run for yet. A second wrap while still masked is lost, so keep critical sections well under 1 ms. |
| Never backwards | Clamp to the last reading and count it (`regressions()`) | Expected to stay 0. The boot report prints it. |
| Pure decision | `read(config, Sample, last)` | The hardware code only samples registers. The pending-wrap and clamp decision is a pure function, unit-tested on the host. |
| Handler | `#[exception] fn SysTick` in each binary, calling `clock::on_systick()` | If the handler lived only in the library, the linker could keep the default handler instead. |

## Boards

| Cargo feature | Board | Core clock | Source label |
| --- | --- | --- | --- |
| `board-qemu-f405` (default) | QEMU `netduinoplus2` (STM32F405) | 168 MHz, fixed | `board assumption` |
| `board-f411` | STM32F411: Black Pill or Nucleo-F411RE | 100 MHz from HSI via the PLL (`stm32f4xx-hal`) | `rcc configured` |

- **QEMU does not configure RCC.** The emulated F405 has no RCC model, so writing the clock tree and waiting for PLL lock would hang.
- **The F411 uses HSI on purpose.** The Black Pill has a 25 MHz crystal and the Nucleo gets 8 MHz from its ST-LINK, so one HSE setting would break the other board. HSI is trimmed to about 1%. That is fine for a monotonic clock, but measuring drift needs the LSE crystal or an external reference.
- **Select exactly one board.** Selecting both, or neither, is a compile error.

### Real hardware (`probe-rs`)

```sh
./scripts/run-hw.sh                                  # kernel, Black Pill (STM32F411CEUx)
./scripts/run-hw.sh clock_selftest                   # clock self-test on the board
PROBE_RS_CHIP=STM32F411RETx ./scripts/run-hw.sh      # Nucleo-F411RE
```

`.cargo/config.toml` now uses `probe-rs run`. The old runner, `probe-run`, is deprecated.

The kernel still prints over semihosting. That works only while a debugger is attached; a semihosting call without one stops the CPU. So run hardware builds through probe-rs only, and check on the first run that probe-rs shows the output.

Hardware builds do not ask the host for the time:

- the Hemant anchor reads `unavailable`;
- the self-test skips the rate and Hemant checks and says so.

Untested here: no board was available for this change. The F411 build compiles, but RCC set-up and SysTick on silicon still need a first run.

## Hemant time

Uptime alone is not Hemant time, because it starts at zero at every boot:

```
hemant_ns_since_epoch = (host_unix_seconds × 10⁹ − HEMANT_SAMWAT_EPOCH_NANOS)
                      + (uptime_now − uptime_at_anchor)
```

`HostAnchor` reads the host clock once over semihosting (`SYS_TIME`). The result is labelled `host-unix-clock-unverified`, the same label the rest of MAATAA uses, because the host clock is still unverified. The monotonic part (`kernel-monotonic-since-boot`) does replace host time for durations and ordering inside the kernel.

## Boot report

```
clock: systick 1000 Hz, core <hz> Hz (board assumption | rcc configured)
board: <qemu-netduinoplus2-stm32f405 | stm32f411>
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
- runs within 50–200% of host wall time over 2 s. It reports separately whether the rate is inside 80–125%. Observed: 99% on a Linux host, 76% on a macOS host.
- produces Hemant time as anchor plus uptime.

QEMU gotchas:

- QEMU does not model cycles exactly. Assert ranges, never exact counts.
- Without `-icount`, QEMU drives SysTick from host timers, so the kernel's rate compared with wall time depends on the host. On macOS the kernel clock ran at 76% of wall time, likely because of host timer slack. The kernel cannot fix that. The test fails only outside 50–200%, which still catches a wrong board clock (12 MHz assumed on a 168 MHz board reads 14 times off). Real hardware needs its own drift measurement, which is still open.
- Use `SYS_ELAPSED` / `SYS_TICKFREQ` as the reference. Do not use `SYS_CLOCK`: QEMU answers it with the host process's **CPU time**, which barely moves while the guest sleeps in `WFI`. With `SYS_CLOCK` the kernel clock looked 14 times faster than the host.
- `cargo test --lib` (`scripts/test-host.sh`) covers the pure logic on the host:
  - the reload math for each board, and refused frequencies;
  - sub-tick nanoseconds, monotonicity across tick boundaries, and saturation;
  - `read()` with a wrap between the tick count and the register read, a wrap between the two register reads, and the clamp-and-report case;
  - the anchor formula.

## Still open

- Trust: a drift reference (RTC plus an external time source) and a signed anchor.
- A request/response channel to the host. The report is still printed once at boot, and then QEMU exits.
- A preemptive scheduler and IPC timeouts driven by this clock.
