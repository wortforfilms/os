# Supervisor call test coverage

Which test exercises each supervisor call of [ABI_SVC.md](ABI_SVC.md), at
`ceb5a63`. Read from the tests themselves, not from their names alone.

- **Unit**: host tests, run by CI (smoke check 5).
- **QEMU**: a smoke check ([EVIDENCE_MATRIX.md](EVIDENCE_MATRIX.md)) or the
  script it runs. "Direct" means a line the check matches comes from that
  call's result; "indirect" means the check only passes if the call worked.
- **Board**: a manual run on the NUCLEO-F411RE; not in CI.
- **Not covered**: result paths no test reaches.

Most unit tests drive the kernel's own functions (`sched`, `persist`,
`installed`, `mailbox`); none of them goes through the `svc` instruction.
That path is exercised only on QEMU and the board.

| SVC | Call | Unit | QEMU | Board | Not covered |
| --- | --- | --- | --- | --- | --- |
| 1 | `WRITE` | `writes_are_allowed_from_flash_or_the_callers_stack_only`, `line_buffer_cuts_long_lines_at_a_char_boundary` | smoke 8, direct (every task line) | yes | `E_PERM` for a buffer outside flash and stack, through the SVC |
| 2 | `LED` | — | smoke 8, direct, refusal only: `task 3: led without capability -> ENOCAP` | yes (task 1 blinks) | the success path in CI (QEMU has no LED to observe) |
| 3 | `DEMO_DONE` | — | smoke 8, indirect: QEMU exits through semihosting after the demo | ignored by the board | — |
| 4 | `TEST_KERNEL_OVERFLOW` | — | builds only: clippy with `kernel-stack-test` and `watchdog-test` | yes (`Flash kernel stack test.command`, `Board watchdog test.command`) | `E_PERM` in a normal build; neither test feature is run in CI |
| 5 | `SEND` | mailbox: `a_message_is_copied_and_delivered_once`, `limits_full_too_long_and_short_buffers`, `messages_of_a_dead_task_are_dropped` | smoke 8, indirect: `task 2: mutex 0 handed off` follows task 2 receiving task 1's message | yes | `E_FULL`, `E_TOOLONG`, a bad destination, through the SVC |
| 6 | `RECV` | `receive_buffers_must_be_in_the_callers_stack`; mailbox: `a_receiver_gets_only_its_own_messages_oldest_first`; sched: `blocked_receiver_wakes_on_message_and_timeout_is_recorded` | smoke 8, indirect (as 5) | yes | `E_TIMEOUT` and `E_AGAIN` through the SVC: the demo prints `task 2: recv timed out after 1000 ms`, but no check matches it; the sender in r1 |
| 7 | `SLEEP` | — | smoke 9 (clock self-test), direct; smoke 8, indirect (capsule schedules, task 1's 2000 ms sleep) | yes | sleep 0 |
| 8 | `MUTEX_LOCK` | sched: 8 tests (FIFO hand-off, wrong owner, bad id, dead owner, lock cycle, inheritance) | smoke 8, direct (hand-off, `EOWNERDEAD`); smoke 14 (inheritance) | yes | `E_BAD_MUTEX`, `E_DEADLOCK`, `E_MUTEX_FULL` through the SVC |
| 9 | `MUTEX_UNLOCK` | sched: `mutex_rejects_wrong_owner_and_invalid_ids`, `unlock_hands_the_lock_to_the_highest_waiter_then_the_oldest` | smoke 8, indirect (hand-off) | yes | `E_NOT_OWNER` through the SVC |
| 10 | `SEMAPHORE_WAIT` | sched: 4 semaphore tests | smoke 8, direct: `semaphore 0 permit received` | yes | `E_BAD_SEMAPHORE`, `E_SEMAPHORE_FULL` through the SVC |
| 11 | `SEMAPHORE_POST` | sched: `semaphore_rejects_invalid_duplicate_full_and_overflow_cases`, `a_post_goes_to_the_highest_waiter_and_the_oldest_among_equals` | smoke 8, indirect (as 10) | yes | `E_SEMAPHORE_OVERFLOW` through the SVC |
| 12 | `UART_WRITE` | `uart_syscall_transfer_is_bounded` | smoke 10 (host channel selftest), indirect | yes (`board-test.sh` selftest) | `E_TOOLONG` through the SVC |
| 13 | `UART_READ` | `uart_syscall_transfer_is_bounded`; sched: `uart_irq_wakes_one_waiter_and_leaves_other_tasks_blocked` | smoke 10, indirect | yes | `E_TOOLONG` through the SVC |
| 14 | `HOST_STATUS` | — | smoke 10, direct (`status`) | yes | a wrong length |
| 15 | `STORE_GET` | persist: `tasks_may_read_but_not_write_kernel_keys` | smoke 11 (`get`, boot count), smoke 15 (panini reads key 40), direct | yes | `E_TOOLONG` (value longer than the buffer), `E_NOT_SUPPORTED` |
| 16 | `STORE_PUT` | persist: `tasks_cannot_touch_kernel_keys`; `maataa-store` crate (24 tests) | smoke 8, direct, refusal: `kernel: task 8 has no capability for syscall 16`; smoke 11, 13, 15, direct | yes | `E_PERM` for a kernel key and `E_FULL`, through the SVC |
| 17 | `CAPSULE_INSTALL` | installed: `accepts_a_signed_wasm_capsule_with_its_manifest`, `refuses_what_it_must`, `version_floors_stop_downgrades_per_name`, `info_layout` | smoke 12, direct: accept, older version, bad signature, built-in name, info, remove | yes (`Board capsule install.command`, panini installs) | an install cut off half-way (begin and write without commit) |
| 18 | `CAPSULE_IMAGE` | — | smoke 12, indirect: `capsule task 9: greeter`, greeter ticks | yes (panini runs as task 9) | a buffer too small |
| 19 | `PARK` | `any_task_may_park_but_other_calls_need_their_capability`; sched: `a_parked_task_is_never_picked_or_woken_again` | smoke 8, direct: fails on `park refused` | yes | `E_BUSY` (a task that holds a lock) |

## Capability gate

`tasks_start_with_no_capabilities_until_granted` and
`any_task_may_park_but_other_calls_need_their_capability` test the mask.
Smoke 8 sees two refusals through the SVC (`LED` for task 3, `STORE_PUT`
for task 8) and a capsule refused at `init` (`-16`, `ENOCAP`). An unknown
call number is refused by the mask (`call_allowed(cap::ALL, SYS_PARK + 1)`
is false in the unit test above), but no test makes such a call through
the SVC.

## Gaps worth a test

1. No CI check sees an error code come back through the `svc`
   instruction except `ENOCAP`; every other error path above is tested
   only in the kernel functions.
2. `RECV` with a timeout: the demo already prints the line; matching it in
   smoke 8 would cover `E_TIMEOUT` through the SVC at no cost.
3. An unknown SVC number returns `E_PERM`: tested on the mask only, never
   through the SVC.
4. A run-time install interrupted between write and commit: the docs say
   the installed capsule is kept; no test checks it.
