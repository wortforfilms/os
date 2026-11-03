# Maataa OS Architecture

How the kernel is put together at `v0.1.0-alpha.7`, from the source. Each
part links to the page that has its details; what is tested where is in
[EVIDENCE_MATRIX.md](../docs/EVIDENCE_MATRIX.md).

## Layers

```text
 run-time capsule (task 9)     built-in capsules (tasks 7, 8)     demo tasks 1-5, host channel (task 6)
        |                               |                                   |
        +---------- WebAssembly interpreter (crates/maataa-wasm) -----------+
                                        |
                      supervisor calls 1-19, capability mask (src/syscall.rs)
                                        |
   scheduler (src/sched)   IPC (mailboxes, mutexes, semaphores)   MPU (src/mpu.rs)   clock (src/clock.rs)
                                        |
   persistent store (src/storage/persist.rs, crates/maataa-store)   capsule area (src/installed.rs)
                                        |
             board (src/board.rs): NUCLEO-F411RE or QEMU netduinoplus2 (STM32F405)
```

All tasks run unprivileged. The only way from a task into the kernel is
`svc`, and each call is checked against the task's capability mask
([ABI_SVC.md](../docs/ABI_SVC.md)).

## Boot flow

1. `src/main.rs` (`cortex-m-rt` entry): the board sets up logging (USART2 on
   the F411, semihosting on QEMU) and its clock tree (100 MHz / 168 MHz),
   the LED, and SysTick at 1 kHz ([kernel-clock.md](../docs/kernel-clock.md)).
2. `kernel::run()` (`src/kernel.rs`):
   - verifies the built-in signed capsules (telemetry, heartbeat, control,
     hostlink) against the capsule key, and checks that a tampered image is
     refused ([capsules.md](../docs/capsules.md));
   - reads the run-time capsule area (sector 5) and checks the installed
     image's signature and version floor;
   - mounts the store, counts the boot (key 0) and saves the reset cause and
     crash record (key 1) ([persistence.md](../docs/persistence.md),
     [watchdog.md](../docs/watchdog.md));
   - prints the boot report and runs a short scripted section (six ticks of
     the simulated driver registry and capsule table, and the native frame
     engines in `src/ipc/`) before the real scheduler starts;
   - returns the capability grants for the tasks.
3. `watchdog::start()` (IWDG on the F411; none on QEMU).
4. `main` builds the run queue and calls `sched::start`, which enables the
   MPU and switches to the first task. From then on PendSV switches tasks.

## Tasks

| Task | Code | Level | Role |
| --- | --- | --- | --- |
| 1 | `demo_task_one` | 1 | holds mutex 0 through a 2 s sleep, sends to task 2, then blinks the LED |
| 2 | `demo_task_two` | 3 | RECV with timeout, mutex hand-off, semaphore, owner-died mutex, refused calls (`svc_error_paths`) |
| 3 | `demo_task_three` | 2 | UART write; refused calls (SEND from kernel memory, RECV into flash, SEND to task 12, LED without capability); after 1.5 s sends to task 2 and posts semaphore 0 |
| 4 | `demo_task_four` | 2 | writes kernel RAM: killed by the MPU while holding mutex 2 |
| 5 | `demo_task_five` | 2 | overflows its stack: killed |
| 6 | `host_channel_task` | 6 | host channel over USART2 ([host-channel.md](../docs/host-channel.md)) |
| 7, 8 | capsule tasks | from the signed manifest (1–4) | telemetry and heartbeat WebAssembly capsules |
| 9 | `installed_capsule_task` | from the signed manifest | the run-time capsule, if one is installed |

The `inversion-test` feature replaces tasks 1–3 with a priority-inversion
test ([SCHEDULER.md](../docs/engineering/SCHEDULER.md)).

## Subsystems

- **Scheduler** (`src/sched/mod.rs`): preemptive through PendSV, strict
  priority between levels, round-robin within a level (5 ms quantum),
  priority inheritance and robust mutexes, a starvation monitor.
- **IPC** (`src/ipc/mailbox.rs`, `src/sched/`): 64-byte messages, 4 mutexes,
  4 semaphores ([kernel-ipc.md](../docs/kernel-ipc.md)).
- **MPU** (`src/mpu.rs`): flash read/execute for tasks, the running task's
  stack read/write, a 256-byte kernel stack guard
  ([kernel-mpu.md](../docs/kernel-mpu.md)).
- **Capsules** (`crates/maataa-capsule`, `crates/maataa-wasm`,
  `src/capsule_task.rs`): ed25519-signed images, a `no_std` i32 WebAssembly
  interpreter with 4 KiB of memory and 20,000 fuel per call
  ([wasm-capsules.md](../docs/wasm-capsules.md)).
- **Store** (`src/storage/persist.rs`, `crates/maataa-store`): a sealed,
  power-loss-safe key-value log on two flash banks.
- **Host channel** (`src/hostlink.rs`, `crates/maataa-link`): COBS frames
  with CRC-32 over USART2; the `maataa-link` host tool.
- **Panini sandhi** (`crates/maataa-sandhi`, `capsules/panini.wat`): the
  sandhi library on the host and the same rules as a run-time capsule
  ([panini.md](../docs/panini.md)).
- **Simulated parts**: `src/drivers/` (a registry with uart and spi slots)
  and the frame engines in `src/ipc/` (terminal, comm, radio, verification)
  run only in the boot report; they touch no hardware.

## Memory

Flash: kernel in sectors 0–4 (128 KiB), run-time capsule in sector 5, store
in sectors 6–7. RAM: 128 KiB, about 84 KiB static. Details and the MPU
regions: [HARDWARE_MEMORY_MAP.md](../docs/HARDWARE_MEMORY_MAP.md).

## Security

What the protections are and what they do not cover:
[SECURITY_THREAT_MODEL.md](../docs/SECURITY_THREAT_MODEL.md).

## History

Until alpha.6 the tree also held never-compiled sketches (Embassy, LittleFS,
defmt) under `src/capsule/`, `src/storage/` and `src/drivers/`, and an
alpha.1 virtual storage manager; they were removed for alpha.7. The alpha.1
design (a scheduler simulation exiting through semihosting) survives only
as the six scripted ticks of the boot report.
