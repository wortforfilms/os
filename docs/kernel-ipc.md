# Task messages, blocking IPC, timed waits, and synchronization (milestones 3–6)

Tasks send each other short messages through the kernel. The kernel **copies**
the bytes in and out; no task ever receives a pointer into another task's
memory, so the MPU isolation of [kernel-mpu.md](kernel-mpu.md) still holds.

## Calls

| `svc` | Call | Registers in | Returns |
| --- | --- | --- | --- |
| 5 | send | r0 = destination task, r1 = pointer, r2 = length | r0 = 0, or an error |
| 6 | recv | r0 = pointer, r1 = capacity, r2 = timeout in ms (0 means nonblocking) | r0 = length and r1 = sender, or r0 = an error |
| 7 | sleep | r0 = duration in ms | returns 0 after the monotonic deadline |
| 8 | mutex lock | r0 = mutex ID (0–3) | r0 = 0 after acquisition, or an error |
| 9 | mutex unlock | r0 = mutex ID (0–3) | r0 = 0, or an ownership/ID error |
| 10 | semaphore wait | r0 = semaphore ID (0–3) | r0 = 0 after a permit, or an error |
| 11 | semaphore post | r0 = semaphore ID (0–3) | r0 = 0, or an error |

Task side: `syscall::send(to, &bytes)`, nonblocking `syscall::recv(&mut buf)`,
`syscall::recv_timeout(&mut buf, timeout_ms)`, `syscall::sleep_ms(ms)`,
`syscall::mutex_lock(id)`, `syscall::mutex_unlock(id)`,
`syscall::semaphore_wait(id)`, and `syscall::semaphore_post(id)`. The raw
receive/send calls exist so the demo can verify that the kernel refuses invalid
memory ranges.

| Error | Value | When |
| --- | --- | --- |
| `EPERM` | `u32::MAX` | the buffer is not the caller's own: send reads only flash or the caller's stack; recv writes only the caller's stack |
| `EAGAIN` | `u32::MAX - 1` | recv: no message for this task |
| `EFULL` | `u32::MAX - 2` | send: all 16 slots are taken |
| `ETOOLONG` | `u32::MAX - 3` | send: more than 64 bytes |
| `ENOTASK` | `u32::MAX - 4` | send: no such task, or it is dead |
| `ETIMEDOUT` | `u32::MAX - 5` | timed receive: its monotonic deadline elapsed without a message |
| `EBLOCKED` | `u32::MAX - 6` | internal retry signal; the syscall wrapper consumes it after task wake |
| `ENOTOWNER` | `u32::MAX - 7` | unlock: caller does not own this mutex |
| `EBADMUTEX` | `u32::MAX - 8` | mutex ID is outside the fixed registry |
| `EDEADLK` | `u32::MAX - 9` | task attempted to lock a mutex it already owns or is already queued for |
| `EMUTEXFULL` | `u32::MAX - 10` | the fixed waiter queue is full |
| `ESEMFULL` | `u32::MAX - 11` | semaphore waiter queue is full |
| `ESEMOVERFLOW` | `u32::MAX - 12` | semaphore count exceeds its `u16` limit |
| `EBADSEMAPHORE` | `u32::MAX - 13` | semaphore ID is outside the fixed registry |

## The queue (`src/ipc/mailbox.rs`)

- 16 slots of up to 64 bytes, in kernel RAM (tasks cannot read it).
- Each message records its sender and destination; recv returns the oldest
  message addressed to the caller. A message longer than the receive buffer is
  cut to fit.
- When the kernel kills a task, every message to or from it is dropped.
- `recv` with timeout 0 remains nonblocking and returns `EAGAIN` when empty.
  `recv_timeout` parks the task, then retries after either a message wake or a
  timeout wake; a message arriving after the deadline stays queued for the
  next receive instead of hiding the timeout result.
- `sleep_ms` uses the same scheduler deadline mechanism. The 1 kHz SysTick
  advances the clock first, then wakes expired tasks and requests PendSV.
- A scheduler-owned idle task runs when every application task is blocked or
  dead, so a blocked task is never selected just because the ready set is empty.
- A successful send wakes a task blocked on that destination's mailbox and
  requests PendSV. The task retries the receive and copies the queued message
  into its own stack buffer.
- The queue logic is plain Rust with host tests (copying, per-receiver order,
  limits, dead tasks).

## Mutexes (milestone 6)

- Four statically allocated mutex IDs (0–3), each with a FIFO queue sized for
  the maximum eight application tasks; no heap allocation is used.
- `svc #8` acquires an unlocked mutex or blocks the caller and queues its task
  ID. The task-side wrapper retries only after wakeup.
- `svc #9` rejects non-owners. Unlock hands ownership directly to the oldest
  waiter before waking it, so a newly arriving task cannot steal the lock.
- If an owner task dies, its mutexes are released and the next live waiter is
  handed ownership. A task blocked on a mutex does not have a timer timeout.
- The F411 demo has Task 1 own mutex 0 while it sleeps for 2000 ms. Task 2
  receives Task 3's delayed message, then blocks on the mutex until Task 1
  wakes and unlocks. This exercises the real SVC path and ownership handoff.

## Counting semaphores (milestone 6)

- Four fixed semaphore IDs (0–3), each with a `u16` permit count and FIFO
  wait queue sized for the maximum eight application tasks. All begin at zero;
  `SemaphoreSet::with_initial_counts` supports kernel-side boot configuration.
- `svc #10` consumes a permit or blocks the caller. `svc #11` transfers a post
  directly to the oldest waiter; otherwise it increments the count. The
  transfer avoids a wake-then-race between queued tasks.
- Dead tasks are removed from semaphore wait queues. Repeated wait, invalid IDs,
  full queues, and count overflow return errors.
- The demo has Task 2 wait on semaphore 0 and Task 3 post after the timed IPC
  and mutex exercise, proving the wait/post syscalls wake a blocked task.

## Verified (28 October 2026)

- `cargo test --workspace`: 67 MAATA OS tests and 7 Hemant core tests passed.
- QEMU `netduinoplus2` runtime demo passed with the requested schedule: task 2
  timed out at 1000 ms; task 3's message at 1500 ms woke task 2 and was
  received; task 1 woke after 2000 ms; mutex ownership handed to task 2; and
  semaphore post woke task 2. The demo exited with status 0.
- STM32F411 release cross-build passed with the repository's Rust 1.91 toolchain.
- Physical STM32F411RE Nucleo run via ST-Link/RTT: Task 2 reported the 1000 ms
  receive timeout, then received Task 3's message sent after 1500 ms. Task 1
  reported waking after its 2000 ms sleep; Task 2 then reported mutex ownership
  handoff. Task 1 subsequently logged `10 blinks`. RTT confirms the blink loop
  continued; the LED itself was not visually observed. The build used the
  default NOP idle path (`low-power` is disabled), and RTT remained connected.
- A second physical run for the new semaphore path could not start: an existing
  `probe-rs run --chip STM32F411RETx ... target/.../maataa-os` process held the
  ST-Link interface exclusively. That process was left untouched. Semaphore
  behavior is verified in host tests and QEMU, but not yet on the board.
- The QEMU clock self-test passed its monotonicity, pending-wrap, and bounded
  host-rate checks; QEMU ran at 78% of host wall time on this run, within the
  test's 50–200% acceptance band. It does not establish external clock
  calibration or trusted wall time.
- The worktree has pre-existing uncommitted IPC/kernel changes. Workspace-wide
  `cargo fmt --all -- --check` reports formatting differences; those were not
  auto-formatted to avoid rewriting unrelated work. Builds emit warnings in
  existing MPU/driver code and the mailbox test.

The timer uses monotonic kernel ticks, not trusted civil or Hemant time. A
physical-board timing run with an external reference and the separate trusted
anchor/host-channel work remain open.

## Next

- Physical verification of the new semaphore syscall remains open until the
  existing ST-Link session releases the probe.
- A message to a task that dies before reading it is dropped silently; a
  delivery status could report that.
- Physical F411 timing still needs an external reference; this prototype does
  not provide signed time anchoring or a host request/response service.
