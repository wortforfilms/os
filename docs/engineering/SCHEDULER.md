# Kernel scheduler

The scheduler in `src/sched/mod.rs` is a fixed-capacity, allocation-free task
queue. Each task owns a caller-provided static stack, an entry function, a
priority, and one of four states: ready, running, blocked, or dead. The queue
holds at most eight tasks. Round-robin is the default policy. Fixed priority
is also available; larger numeric values win, so a continuously ready high
priority task can starve lower priority tasks by design.

`Scheduler::pick(&RunQueue, now)` receives the queue and an explicit monotonic
tick value. A policy never reads SysTick registers, calls `clock::get_ticks`,
or consults hidden hardware state. Round-robin uses the queue's `Running` task
and its stable slot order; fixed priority reads task priorities. Given the same
queue and timestamp, each policy returns the same choice. This makes the
policy decision deterministic and host-testable while the clock source stays
replaceable.

Preemption follows this path:

1. SysTick calls `clock::on_systick()` to increment the monotonic counter.
2. `sched::on_systick()` checks whether the running task's quantum expired. It
   only sets PendSV; it does not edit task state or save registers.
3. PendSV saves the interrupted task's stack pointer and callee-saved register
   context, selects the next runnable task, marks its state, and restores that
   task's context. PendSV runs at the lowest exception priority.

Scheduler startup builds the initial hardware exception frame on each task's
provided stack; the first PendSV returns into the first task. The QEMU demo
runs three tasks with a 5 ms quantum. Each prints its ID and executes a
1,000,000-cycle delay. QEMU exits after observing the third task. The F411
boot report uses `tasks=0 first_switch_at_ms=0` because that board build does
not start the QEMU-only demo. Floating-point callee-saved registers are
preserved when the exception frame indicates an active FP context.

Host tests cover the three-task round-robin cycle, fixed-priority selection,
strict-priority starvation over 1,000 picks, empty queues, and skipping blocked
or dead tasks. QEMU smoke checks validate the boot-report line and the observed
`task 1`, `task 2`, `task 3` order. The earlier F411 preemption and clock
observations used RTT; USART2 TX and interrupt-driven RX were physically
verified on the Nucleo-F411RE ST-LINK serial port at 115200 baud using task
SVCs. SVC 13 now parks an empty reader and the RX interrupt wakes one waiter;
the blocking wake path has unit and target-build coverage, while a fresh board
capture remains pending. See `docs/kernel-clock.md`.
