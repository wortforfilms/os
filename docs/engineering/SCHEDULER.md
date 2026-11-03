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

A semaphore post and a mutex unlock both go to the waiting task with the
highest level, the oldest among equals.

### Priority inheritance

Each task has a base level and an effective level; the policy uses the
effective one. While a task owns a lock, it runs at least at the level of the
highest task waiting for it. The kernel recomputes every effective level
from the base levels after each block on a lock, unlock and task death,
repeating until nothing changes (`RunQueue::apply_inheritance`). So:

- a raise passes along a chain: if A waits for B's lock and B waits for C's,
  C runs at A's level;
- a waiter that arrives late still raises the owner (and the chain behind it);
- a raise ends as soon as the lock is released or the waiter leaves, and the
  owner falls back to whatever its remaining locks still justify.

With 9 tasks and 4 locks the recompute is a few dozen comparisons.
`scripts/qemu-inversion-test.sh` (feature `inversion-test`) acts out the
classic inversion, low task holding the lock, high task waiting, middle task
computing for over a second, and runs it twice: with inheritance the high
task gets the lock before the middle task finishes; built with `pi-off` it
does not, and the starvation monitor reports the low task while it holds
the lock. Both runs use `-icount shift=3`, so they are the same every time.
`scripts/board-inversion-test.sh` (`Board inversion test.command`) runs the
same two kernels on the NUCLEO-F411RE in real time (L works 0.4 s, M 3 s at
100 MHz), with the same checks on the USART2 log, and then flashes the
normal kernel back.

### Lock cycles

Before a task waits, the kernel follows owner, the lock that owner waits
for, its owner, and so on. If the chain comes back to the caller, waiting
would hang every task in the cycle, so the lock call fails with `E_DEADLOCK`
and the caller is not queued. Re-locking a lock you hold is the same error.

### An owner that dies

When a task dies holding a lock (killed by the MPU, for example), the lock
goes to its highest waiter, whose lock call returns `E_OWNER_DIED`
(u32::MAX - 18; a capsule sees -19). That is a success: the caller owns the
lock, but what the lock guards may be half updated. `syscall::mutex_lock`
returns `Ok(Acquired::OwnerDied)`. If nobody was waiting, the lock is
released and the next task to take it gets the same answer, once. The demo
shows it: task 4 takes mutex 2 before its protection test, dies holding it,
and task 2 later reports `mutex 2: its owner died holding it (EOWNERDEAD)`.

## Starvation monitor

On every tick the kernel checks how long each Ready task has gone without
running. A task Ready for `STARVATION_LIMIT_MS` (1000 ms) is reported once
per episode:

```
sched: task 1 (priority 1) ready for 1000 ms without running
```

The episode ends when the task runs or blocks. The idle task is never
counted. The number of episodes since boot is in RAM and tasks read it as
kernel key 3 (`store_get(3)`, u32 little-endian; also `maataa-link get 3`
over the host channel); it is never written to flash. Under strict priority
a busy higher task starving a lower level is expected, so a report is a
prompt to look, not an error. The demo build reports none.

## Tests

Host tests cover top-level selection and rotation, even sharing among 3,000
picks at one level, idle selection, the preemption rule, parking, the
semaphore and mutex hand-off order, inheritance (direct, along a chain, a
late waiter, falling back, and off), lock cycles, a dead owner reported
once, the starvation monitor, the park exemption from the capability gate,
the manifest `priority` key, and the older policies. `scripts/smoke-alpha.sh` checks the
boot line, the start order (task 2, task 3, task 1), the mutex hand-off and
the semaphore wake under priorities, the dead-owner report on mutex 2, that
no task failed to park or starved, and runs the inversion test.

## Board run (NUCLEO-F411RE, 2026-11-01)

Host channel selftest passed and STATUS reported tasks 8/10 alive on both
builds. Twenty `maataa-link ping` round trips took 15 to 21 ms (median
20.5 ms) under round-robin (7e4830f) and 2 to 3 ms (median 2 ms) under
strict priority (cede19a).
