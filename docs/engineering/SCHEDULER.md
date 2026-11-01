# Kernel scheduler

The scheduler in `src/sched/mod.rs` is a fixed-capacity, allocation-free task
queue. Each task owns a caller-provided static stack, an entry function, a
priority, a capability mask, and one of four states: ready, running, blocked,
or dead. The queue holds up to nine application tasks plus the kernel's idle
task.

## Policy: strict priority, round-robin within a level

The kernel runs `PriorityRoundRobin`:

- Higher numbers win. A level runs only while no task above it is ready.
- Tasks of the same level take turns, 5 ms each (`DEFAULT_DEMO_QUANTUM_MS`),
  in slot order starting after the task that ran last.
- The idle task (level 0) runs only when no application task can.

So a task that never blocks starves every level below it. That is the
contract, not a bug: every task above the lowest application level must
block (sleep, receive, wait on a mutex or semaphore, read the UART, or park)
when it has nothing to do.

| Level | Tasks |
| --- | --- |
| 6 | host channel (task 6) |
| 1 to 4 | capsules (tasks 7, 8 and 9), from `priority=` in the signed manifest; default 1 |
| 3 | demo task 2 |
| 2 | demo tasks 3, 4 and 5 |
| 1 | demo task 1 (blinks forever without yielding) |
| 0 | idle |

The levels are set in `src/main.rs`. A capsule's level is part of its signed
`maataa` manifest section (`docs/wasm-capsules.md`); the kernel reads it at
boot, before the task exists, with a section walk that parses no code
(`maataa_wasm::manifest_section`). A capsule may ask for 1 to 4 only; a
manifest the task will refuse anyway counts as level 1.

`RoundRobin` and `FixedPriority` remain as plain policies for the host tests.
`Scheduler::pick(&RunQueue, now)` receives the queue and an explicit tick
value and never reads hardware, so each choice is deterministic and
host-testable.

## When the switch happens

1. SysTick advances the clock and wakes tasks whose deadline passed.
2. `sched::on_systick()` requests PendSV if a woken task outranks the running
   one, or if the running task's quantum ran out.
3. The other wake paths (mutex unlock, semaphore post, message send, the
   USART2 receive interrupt) also request PendSV at once when the task they
   wake outranks the running one. A wake at the same or a lower level waits
   for the quantum or for the running task to block.
4. Blocking, parking and a task's death always request PendSV.
5. PendSV, the lowest-priority exception, saves the running task's context,
   asks the policy for the next task and restores it. Floating-point
   callee-saved registers are kept when the frame says FP state is live.

## Park (syscall 19)

A task whose work is done calls `syscall::park_forever()`. The task blocks
with no deadline and no wake source and stays alive (STATUS counts it). Park
needs no capability: any task may give up the processor, including one with
an empty mask. Parking while holding a mutex is refused with `E_BUSY`
(u32::MAX - 17; a capsule sees -18), since the lock would then never be
released. `park_forever` reports that once and falls back to one-second
sleeps.

## Semaphores and mutexes

A semaphore post goes to the waiting task with the highest level, the oldest
among equals. A mutex unlock still hands the lock to the oldest waiter, and
a task that dies hands its locks on the same way. A low task holding a lock a
high task waits for can still be delayed by middle levels (priority
inversion); priority inheritance is the next commit.

## Tests

Host tests cover top-level selection and rotation, even sharing among 3,000
picks at one level, idle selection, the preemption rule, parking, the
semaphore order, the park exemption from the capability gate, the manifest
`priority` key, and the older policies. `scripts/smoke-alpha.sh` checks the
boot line, the start order (task 2, task 3, task 1), the mutex hand-off and
the semaphore wake under priorities, and that no task failed to park.

## Board run (NUCLEO-F411RE, 2026-11-01)

Host channel selftest passed and STATUS reported tasks 8/10 alive on both
builds. Twenty `maataa-link ping` round trips took 15 to 21 ms (median
20.5 ms) under round-robin (7e4830f) and 2 to 3 ms (median 2 ms) under
strict priority (cede19a).
