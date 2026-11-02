# Watchdog, reset cause and crash report

The board resets itself when the kernel stops working. After the reset, the
next boot reports why the board reset and, if the kernel had stopped on an
error, what that error was. The host can read the same report at any time.

```text
reset cause: watchdog
last crash: kernel stack overflow (address 0x20004180, detail 0x00000092, at 5 ms)
watchdog: IWDG 8000 ms nominal, fed by the scheduler tick
```

Code: `src/watchdog.rs`, `src/crash.rs`, and the boot report in
`src/kernel.rs`. The record format is `maataa_link::BootRecord`.

## Watchdog (F411)

- **What it is.** The independent watchdog (IWDG) runs from the ~32 kHz LSI
  oscillator, counting down from 2000 at 250 Hz. That is 8 s nominal. The LSI
  is only accurate to about ±50 %, so the real timeout lies between about 5.4
  and 11.8 s.
- **When it is fed.** The kernel feeds it on every scheduler tick (1 kHz). So
  it fires when interrupts stay off or the kernel is stuck in a fault handler,
  the cases no task can recover from. A task spinning in a loop does not trip
  it, because preemption already handles that.
- **Started after boot.** It starts after the boot sequence, just before the
  scheduler. A first-time format of the flash store (one sector erase) at
  boot therefore cannot trip it.
- **Flash erase.** The timeout is longer than the worst-case 4 s sector erase
  during compaction, while which the CPU stalls and cannot feed it.
- **Debug probe.** The watchdog is frozen while a debug probe halts the core
  (`DBG_IWDG_STOP`).
- **QEMU** has no IWDG model, so the boot report there says
  `watchdog: not available on this board`.

## Reset cause (F411)

At boot the kernel reads the reset flags in `RCC_CSR`, then clears them.
Several flags can be set at once (an external reset also sets the pin flag),
so the most specific one wins:

watchdog > window watchdog > software > low power > power-on > brown-out >
reset pin or debugger

QEMU has no RCC model, so the cause there is `unknown`.

## Crash record

When the kernel stops on its own error, it writes a 24-byte record, guarded
by a checksum, into RAM that the startup code does not clear (`.uninit`). It
does this for:

- a panic (the record keeps the source line);
- a kernel stack overflow;
- a kernel memory fault;
- a hard fault (the record keeps the pc and CFSR).

The kernel then stops, and on the F411 the watchdog resets the board. The
next boot reads and clears the record, and prints it as `last crash: …`. A
power cut loses the record, because RAM is not kept, so only the reset cause
survives it.

## Persistent key 1

Each boot writes the reset cause and the crash (if any) to persistent key 1
as a 16-byte `BootRecord`. Tasks, and so the host, may **read** kernel keys
0 to 15, but may not write them. The host tool shows key 0 (the boot count)
and key 1:

```bash
target/release/maataa-link --serial /dev/cu.usbmodem11303 boot-info
# boot 12; reset cause: watchdog; last crash: none
```

The host channel `selftest` includes a `boot info` check.

## Tests

- **Host** (`cargo test`):
  - record round-trip and checksum;
  - decoding the reset flags;
  - the watchdog's prescaler and reload, against the 8 s timeout;
  - `BootRecord` encoding.
- **QEMU** (`smoke-alpha.sh`): the boot report lines
  `reset cause: unknown`, `last crash: none` and
  `watchdog: not available on this board`.
- **Board** (`Board watchdog test.command`):
  1. Flashes a `watchdog-test` build. In it, task 2 asks the kernel (syscall
     4) to hang with interrupts off.
  2. The watchdog must reset the board.
  3. The next boot must report `reset cause: watchdog`. Since the last reset
     came from the watchdog, the kernel declines to hang again and prints
     `watchdog test: PASS`.
  4. The command then reads key 1 straight from flash with the probe
     (`scripts/read-board-store.py`), so the result does not depend on the
     serial port.
  
  Afterwards, flash the normal kernel again (`Board test.command`).

## Board results (NUCLEO-F411RE, 2026-10-31)

- **Watchdog test: PASS.** Read from flash after the hang:

  ```text
  boot count: 44
  reset cause: watchdog
  last crash: none
  PASS: the watchdog reset the hung kernel, and the next boot recorded it
  ```

- **No false resets.** On the normal kernel the uptime kept rising past
  2 minutes (read with the probe 3 s apart), with the watchdog running. The
  stored cause after a `probe-rs` flash was `software reset`, as expected.
