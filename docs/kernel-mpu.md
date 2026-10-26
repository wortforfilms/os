# Task memory protection (MPU), milestone 1

Tasks run **unprivileged**, each inside its own MPU region. They reach the
kernel only through supervisor calls. A task that touches memory it does not
own is killed; the other tasks keep running.

## Regions (Cortex-M4, ARMv7-M MPU)

| Region | Memory | Kernel (privileged) | Tasks (unprivileged) |
| --- | --- | --- | --- |
| background | everything | default memory map (`PRIVDEFENA`) | no access |
| 0 | flash, first 512 KB | read, execute | read, execute |
| 1 | the running task's stack | read, write | read, write, never execute |

- Kernel RAM, peripherals (GPIO, RCC, …) and other tasks' stacks are outside
  every task region.
- Region 1 is reprogrammed in PendSV on every switch (`mpu::set_task_stack`).
- A task stack must be a power of two (at least 32 bytes) aligned to its own
  size. The demo uses 2 KB stacks aligned to 2 KB. `start_round_robin`
  refuses other stacks with `StackNotProtectable`.
- PendSV sets `CONTROL.nPRIV` before returning to a task, with `dsb`/`isb`.
- The MemManage fault is enabled (`SHCSR.MEMFAULTENA`).

## Supervisor calls (`src/syscall.rs`)

| `svc` | Call | r0 | r1 | Returns |
| --- | --- | --- | --- | --- |
| 1 | write text to the kernel log | pointer | length | bytes written, or `u32::MAX` if refused |
| 2 | set the user LED | 0 off, else on | | 0 |
| 3 | demo finished (QEMU exits, boards ignore it) | | | 0 |

The kernel accepts a write only if the whole buffer lies in flash or in the
caller's own stack. Tasks print with `uprintln!`, which formats on the task's
stack and makes one `svc #1`.

## Faults

- **Task fault** (thread mode, PSP): the task is marked dead, the kernel prints
  the kind of access, the address and the faulting pc, resumes the dead task in
  an idle loop and pends PendSV, which switches to the next task.
- **Kernel fault** (handler mode or the boot thread): reported, then the system
  stops.
- **Limit:** a fault during exception stacking or unstacking (`MSTKERR`,
  `MUNSTKERR`, `MLSPERR`, typically a task stack overflow) leaves no usable
  frame; milestone 1 reports it and stops the system instead of killing only
  the task.

## Verified on the board (26 October 2026)

NUCLEO-F411RE, `Flash Nucleo F411.command`, 30-second run:

```
sched: round-robin tasks=4 first_switch_at_ms=5
mpu: tasks unprivileged, own stack region, flash read-only; syscalls: write, led, demo_done
task 1
task 2
task 3
task 4: writing to kernel memory at 0x20002800
task 4 violated memory: data access at 0x20002800 (pc 0x080008f0); task killed, kernel word still 0x00000000
task 1: 10 blinks
```

Task 4's write to a kernel word was stopped, the word kept its value, and
task 1 kept blinking LD2 through `svc #2` afterwards. Host tests: 52 pass
(region encoding, bounds checks, syscall buffer rules).

QEMU (`Run QEMU.command`, netduinoplus2 / STM32F405) gives the same result:
task 4's write to `0x20002800` is stopped, the word stays `0x00000000`, task 4
is killed, and task 3's `svc #3` ends the run with exit status 0.

## Next

- Kill only the task on a stack overflow (rebuild a frame, or switch inside
  the fault handler).
- A guard region below each stack, so overflow faults before it corrupts.
- More calls: sleep, yield, a real UART write; then IPC.
