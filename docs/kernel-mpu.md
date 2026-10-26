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
- **Stack overflow** (`MSTKERR`, `MUNSTKERR` or `MLSPERR`: the hardware could
  not stack or unstack the task's frame): there is no frame to return through,
  so the kernel writes a fresh 8-word frame at the top of the dead task's own
  stack, aimed at the idle loop, points PSP at it and leaves with
  `EXC_RETURN = 0xFFFFFFFD` (thread, PSP, basic frame). The task is killed;
  the others keep running. Below a task stack there is nothing a task may
  touch, so no extra guard region is needed for tasks.
- The kernel's own stack (MSP) has no guard yet: privileged code is not
  limited by the background map, so a kernel overflow would still corrupt
  `.bss` silently. A no-access guard region at the stack's low end is next.

## Verified on the board (27 October 2026)

NUCLEO-F411RE, `Flash Nucleo F411.command`, 30-second run:

```
sched: round-robin tasks=5 first_switch_at_ms=5
task 1
task 2
task 3
task 4: writing to kernel memory at 0x20003000
task 4 violated memory: data access at 0x20003000 (pc 0x08000974); task killed, kernel word still 0x00000000
task 5: recursing until the stack overflows
task 5 overflowed its stack (stacking, mmfsr=0x92); task killed
task 1: 10 blinks
```

`mmfsr = 0x92` is MMARVALID + MSTKERR + DACCVIOL. Both bad tasks were killed
and task 1 kept blinking LD2 through `svc #2`. QEMU (`Run QEMU.command`) gives
the same two kills and ends with exit status 0. Host tests: 52 pass.

The RTT up-channel is now 4 KB (non-blocking). With the default 1 KB the burst
of task lines overflowed the buffer before probe-rs read it, and the task 5
lines were dropped on the first board run.

## Next

- A no-access guard region at the low end of the kernel stack (MSP).
- IPC: `svc #4` send and `svc #5` receive through a kernel message queue,
  copying the data (never passing pointers between tasks).
- More calls: sleep, yield, a real UART write.
