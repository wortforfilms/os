# Task memory protection (MPU), milestone 1

Tasks run **unprivileged**, each inside its own MPU region. They reach the
kernel only through supervisor calls. A task that touches memory it does not
own is killed; the other tasks keep running.

## Regions (Cortex-M4, ARMv7-M MPU)

| Region | Memory | Kernel (privileged) | Tasks (unprivileged) |
| --- | --- | --- | --- |
| background | everything | default memory map (`PRIVDEFENA`) | no access |
| 0 | flash, first 512 KB | read, write, execute (`AP_PRIV_RW`: the kernel programs the capsule and store sectors) | read, execute |
| 1 | the running task's stack | read, write | read, write, never execute |
| 2 | kernel stack guard: 256 bytes at the low end of the main stack | no access | no access |

- Kernel RAM, peripherals (GPIO, RCC, …) and other tasks' stacks are outside
  every task region.
- Region 1 is reprogrammed in PendSV on every switch (`mpu::set_task_stack`).
- A task stack must be a power of two (at least 32 bytes) aligned to its own
  size. The demo uses 2 KB stacks aligned to 2 KB. `start_round_robin`
  refuses other stacks with `StackNotProtectable`.
- PendSV sets `CONTROL.nPRIV` before returning to a task, with `dsb`/`isb`.
- The MemManage fault is enabled (`SHCSR.MEMFAULTENA`).

## Supervisor calls

Milestone 1 had three calls (write, LED, demo done). The current set, 1 to
19, with registers, limits and error codes, is in
[ABI_SVC.md](ABI_SVC.md). The kernel reads a task buffer only if the whole
buffer lies in flash or in the caller's own stack, and writes one only inside
the caller's stack (`syscall::buffer_allowed`, `syscall::writable_allowed`).

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
- **Kernel stack overflow.** Region 2 is a 256-byte no-access guard at the
  first 256-aligned address above `__sheap`, the lowest point the main stack
  may reach. It is closed to the kernel too, so a kernel that recurses too deep
  faults on the guard instead of overwriting `.bss`. 256 bytes is more than
  the largest exception frame (104 bytes with FPU state). The MemManage and
  HardFault stubs move MSP back to `_stack_start` before anything is pushed,
  then report and stop: a kernel bug is reported, not repaired. A function with
  locals larger than the guard could still step over it.
- **Priorities.** MemManage keeps priority 0; SVCall and SysTick are set to
  0x40 and PendSV to 0xFF. Otherwise a fault inside a supervisor call cannot
  preempt it (equal priority) and escalates to HardFault, which is what the
  first guard test showed: "HardFault <Cause: Escalated MemManage Fault>".
- The guard and the task regions are active from `start_round_robin` on; the
  boot code before it runs without the MPU.

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

### Kernel stack guard (27 October 2026)

Test build `--features board-f411,kernel-stack-test`
(`Flash kernel stack test.command`): task 2 makes `svc #4`, and the kernel
recurses on the main stack.

```
task 2
kernel: recursing on the main stack (kernel-stack-test)
KERNEL STACK OVERFLOW: the main stack reached its guard 0x20004100..0x20004200 (sp 0x200041c0, stacking at 0x200041d8, mmfsr=0x92); system stopped
```

QEMU (`Run QEMU kernel stack test.command`) reports the same, with the guard at
0x20003100. The normal build still kills task 4 and task 5 and keeps task 1
blinking, on the board and in QEMU. Host tests: 53 pass.

The RTT up-channel is now 4 KB (non-blocking). With the default 1 KB the burst
of task lines overflowed the buffer before probe-rs read it, and the task 5
lines were dropped on the first board run.

## Follow-up status

That historical roadmap was superseded by the IPC and scheduling milestones.
USART2 TX and task-level SVC receive were physically verified on the
Nucleo-F411RE ST-LINK serial port at 115200 baud. The task uses SVC 13 to read
from a kernel-owned FIFO and SVC 12 to echo; it does not access driver state
directly. See `docs/kernel-clock.md`. The echo is now replaced by the host
channel task, which reads the kernel status through SVC 14 into its own stack
(`docs/host-channel.md`).
