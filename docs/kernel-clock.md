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
| Handler | `#[exception] fn SysTick` calls `clock::on_systick()` then `sched::on_systick()` | SysTick measures and requests PendSV; PendSV performs the context switch. |

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

At the time of the earlier hardware run below, kernel output used RTT. The
current F411 path initializes USART2 at 115200 baud and sends logs through the
Nucleo-F411RE ST-LINK virtual COM connection (PA2 TX, PA3 RX); QEMU retains its
semihosting output. USART2 has since been verified on the physical Nucleo
through its ST-LINK virtual COM port; see the 28 October evidence below.

Hardware builds do not ask the host for the time:

- the Hemant anchor reads `unavailable`;
- the self-test skips the rate and Hemant checks and says so.

## Hardware verification (26 October 2026)

Board: NUCLEO-F411RE (STM32F411RET6), ST-LINK, `probe-rs run --chip STM32F411RETx`.
Run log: `target/nucleo-run.log` (30-second run, no exception, no reset).

- **PASS** — RCC configured: the HAL reports a 100 MHz core clock after the PLL
  is set up from HSI, and the kernel runs on it (`clock: systick 1000 Hz, core
  100000000 Hz (rcc configured)`). The frequency was not measured externally.
- **PASS (self-consistent)** — SysTick at 1 kHz: each 10 ms kernel sleep
  measured about 10.15 ms on the kernel clock (uptime 21.06, 31.21, 41.36,
  51.51 ms at ticks 3 to 6), with 0 clock regressions. Checking the rate
  against an external reference still needs the LSE crystal or a scope.
- **PASS** — RTT output is visible in probe-rs: the full boot report.
- **PASS** — tasks preempt on hardware: task 1 never yields after printing,
  yet task 2 and task 3 print, so the 5 ms quantum switched them.

### WFI and RTT on the F411

With the core asleep in WFI, the ST-LINK read only zeros from RAM and
peripherals, so probe-rs lost RTT and reported "Firmware exited unexpectedly:
Exception". Setting `DBGMCU_CR` DBG_SLEEP, DBG_STOP and DBG_STANDBY (they read
back as `0x7`) did not change that on this board. `clock::idle()` therefore
uses a NOP on the F411 by default to keep probe debugging reliable. Build with
`--features board-f411,low-power` to use WFI; USART2 itself is independent of
RTT and remains the configured log transport.

### USART2 serial output (28 October 2026)

The F411 board configures USART2 through `stm32f4xx-hal`: 115200 baud, 8-N-1,
PA2 TX and PA3 RX. Kernel logs use the UART, and SVC 12/13 expose byte write
and nonblocking read operations to tasks, capped at 256 bytes per call. SVC
10/11 remain semaphore wait/post. The F411 release build was flashed and run
with `probe-rs`; a host serial terminal at 115200 baud captured the complete
boot report and task logs, including timed receive, mutex handoff, and
semaphore wake-up. This verifies the Nucleo-F411RE USART2 TX path and VCP
configuration. The first capture did not exercise RX. Black Pill boards need
an external USB-UART adapter.

### USART2 interrupt-driven receive (28 October 2026)

USART2 RXNE and NVIC IRQ 38 feed a 256-byte kernel-owned FIFO. SVC 13 drains
available bytes; if it finds the FIFO empty, it atomically blocks the caller
and returns an internal retry result. The IRQ queues a received byte, wakes one
blocked reader, and pends the scheduler. A full FIFO drops the new byte and
records a drop count. The demo task uses only SVC calls and echoes received
bytes through SVC 12 without polling. On the Nucleo-F411RE, the serial terminal
showed the direct task-level SVC 12 marker and echoed the typed strings
`rx-test-123` and `IRQ_RX_OK`; that capture predates blocking reads.

The blocking path was verified on the Nucleo-F411RE on 2026-10-30. The echo
task blocked in SVC 13 for several hundred task-1 blink lines, then woke on
typed input and echoed `h` and `hello-123`, while task 1 kept running. USART2
TX waits are bounded (100k status polls for TXE and TC); a timeout returns
`DriverError::Timeout` and is recorded in `MAATAA_UART_TX_DIAG`, which a probe
can read.

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
sched: round-robin tasks=<n> first_switch_at_ms=<quantum>
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

The boot report's scheduler line records the selected policy, task count, and
configured first-switch quantum. The existing six-tick telemetry simulation
still sleeps 10 ms between ticks; afterward the QEMU demo starts three
preemptive tasks with a 5 ms quantum. Their round-robin order is checked by
`scripts/smoke-alpha.sh`.

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
- `cargo test` covers the pure logic on the host:
  - the reload math for each board, and refused frequencies;
  - sub-tick nanoseconds, monotonicity across tick boundaries, and saturation;
  - `read()` with a wrap between the tick count and the register read, a wrap between the two register reads, and the clamp-and-report case;
  - the anchor formula.
  - the fixed-capacity scheduler policies and run-queue states.

## Still open

- Trust: a drift reference (RTC plus an external time source) and a signed anchor.
- A request/response channel to the host. The report is still printed once at boot, and then QEMU exits.
- IPC timeouts driven by this clock.
