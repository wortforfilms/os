# Kernel ABI: supervisor calls

The supervisor-call (SVC) interface is the only way an unprivileged task
reaches the kernel. This page is derived from `src/syscall.rs` at
`7b99bdb` and is the canonical list; if this page and the source ever
disagree, the source is right and this page is a bug.

Stability: **alpha**. The numbers below have not changed since alpha.3,
but no compatibility promise is made before a non-alpha release.

## Calling convention

- A task executes `svc #N`; the kernel reads N from the immediate byte of the
  SVC instruction (the byte before the stacked pc).
- Arguments are in r0, r1, r2 (and r3 is not used). The result is written
  back to the caller's r0; receive (6) also writes the sender to r1.
- Results at or above `E_LOWEST` (`u32::MAX - 18`) are errors; smaller
  values are counts, lengths or 0.
- **Capability gate.** Every task has a 32-bit capability mask: bit N allows
  call N. A call outside the mask returns `E_NOCAP` before its arguments are
  read, and the kernel logs `kernel: task T has no capability for syscall N`.
  Call 19 (park) needs no capability. Masks come from the signed capsule
  manifest (built-in and run-time capsules) or are set by the kernel (demo
  tasks); the names a manifest uses are in `maataa_capsule::cap`
  (`write`, `led`, `send`, `recv`, `sleep`, `mutex` = bits 8 and 9,
  `semaphore` = bits 10 and 11, `uart_write`, `uart_read`, `host_status`,
  `store_get`, `store_put`, `capsule_install`, `capsule_image`).
- **Buffer checks.** The kernel reads a task buffer (write, send) only if it
  lies wholly in flash or in the caller's own stack, and writes one
  (receive and the other reads) only if it lies in the caller's own stack;
  otherwise the call returns `E_PERM`.
- An unknown call number returns `E_PERM`.

## Calls

| N | Name (`SYS_*`) | r0 | r1 | r2 | Result (r0) |
| --- | --- | --- | --- | --- | --- |
| 1 | `WRITE`: text to the kernel log | pointer | length | | bytes written, or `E_PERM` |
| 2 | `LED`: set the user LED | 0 = off, else on | | | 0 |
| 3 | `DEMO_DONE` (QEMU exits; boards ignore it) | | | | 0 |
| 4 | `TEST_KERNEL_OVERFLOW`: test builds only (`kernel-stack-test`: recurse on the kernel stack; `watchdog-test`: hang with interrupts off) | | | | never returns, or 0; `E_PERM` in other builds |
| 5 | `SEND`: copy a message into the kernel queue | destination task | pointer | length (≤ 64) | 0, `E_FULL`, `E_TOOLONG`, `E_NOTASK`, `E_PERM` |
| 6 | `RECV`: copy the next message into the caller's buffer | pointer | capacity | timeout ms (0 = do not wait) | length, sender in r1; `E_AGAIN` (empty, timeout 0), `E_TIMEOUT`, `E_PERM` |
| 7 | `SLEEP` until a monotonic deadline | milliseconds (0 returns at once) | | | 0 or `E_AGAIN` |
| 8 | `MUTEX_LOCK` | mutex id (0..4) | | | 0, `E_OWNER_DIED` (locked; the previous owner died holding it), `E_BAD_MUTEX`, `E_DEADLOCK`, `E_MUTEX_FULL` |
| 9 | `MUTEX_UNLOCK` | mutex id | | | 0, `E_NOT_OWNER`, `E_BAD_MUTEX` |
| 10 | `SEMAPHORE_WAIT` | semaphore id (0..4) | | | 0, `E_BAD_SEMAPHORE`, `E_SEMAPHORE_FULL` |
| 11 | `SEMAPHORE_POST` | semaphore id | | | 0, `E_BAD_SEMAPHORE`, `E_SEMAPHORE_OVERFLOW` |
| 12 | `UART_WRITE`: bytes to the board UART | pointer | length (≤ 256) | | bytes written, `E_TOOLONG` (> 256), `E_NOT_SUPPORTED`, `E_PERM` |
| 13 | `UART_READ`: blocks until bytes arrive | pointer | capacity (≤ 256) | | bytes read, `E_TOOLONG` (> 256), `E_NOT_SUPPORTED`, `E_PERM` |
| 14 | `HOST_STATUS`: copy the host-channel status block | pointer | length (`hostlink::HOST_STATUS_BYTES`) | | 0, `E_TOOLONG`, `E_PERM` |
| 15 | `STORE_GET`: read a persistent key | key (0..64) | pointer | capacity | length, `E_NOENT`, `E_TOOLONG` (value longer than the capacity), `E_PERM` (bad key or buffer), `E_NOT_SUPPORTED` (no store) |
| 16 | `STORE_PUT`: write a persistent key (an empty value deletes it) | key (16..64) | pointer | length (≤ 64) | 0, `E_TOOLONG`, `E_FULL` (store full), `E_PERM` (kernel key or bad buffer), `E_NOT_SUPPORTED` (no store or a store error) |
| 17 | `CAPSULE_INSTALL`: run-time capsule install | operation \| offset << 8 (operations: 0 begin, 1 write, 2 commit, 3 remove, 4 info) | pointer | length | 0, a length, or an error |
| 18 | `CAPSULE_IMAGE`: copy the installed capsule's image | pointer | capacity | | length or an error |
| 19 | `PARK`: block for good (no capability needed) | | | | never returns; `E_BUSY` while the caller holds a mutex |

Limits behind these numbers: `MAX_MESSAGE` = 64 bytes and 16 queue slots
(`src/ipc/mailbox.rs`), `MAX_MUTEXES` = `MAX_SEMAPHORES` = 4
(`src/sched/mod.rs`), `MAX_UART_TRANSFER` = 256, store `KEYS` = 64 and
`MAX_VALUE` = 64 bytes (`crates/maataa-store`), task keys from
`FIRST_TASK_KEY` = 16 (keys 0..16 are the kernel's; key 0 is the boot count,
key 3 the starvation-episode count, read from RAM).

## Error codes

| Code | Value | Meaning |
| --- | --- | --- |
| `E_PERM` | `u32::MAX` | buffer outside the caller's memory, or an unknown call |
| `E_AGAIN` | `MAX - 1` | no message waiting (receive with timeout 0); sleep when the caller cannot block |
| `E_FULL` | `MAX - 2` | the kernel queue is full (send); the store is full (store put) |
| `E_TOOLONG` | `MAX - 3` | longer than a limit: a 64-byte message or store value, a 256-byte UART transfer, the host-status block, or a value longer than the caller's buffer |
| `E_NOTASK` | `MAX - 4` | destination task missing or dead (send) |
| `E_TIMEOUT` | `MAX - 5` | receive deadline elapsed |
| `E_BLOCKED` | `MAX - 6` | internal: the task was parked and retries the receive (the library hides it) |
| `E_NOT_OWNER` | `MAX - 7` | unlock by a task that does not own the mutex |
| `E_BAD_MUTEX` | `MAX - 8` | mutex id outside the registry |
| `E_DEADLOCK` | `MAX - 9` | recursive lock, or a wait that would close a lock cycle |
| `E_MUTEX_FULL` | `MAX - 10` | mutex waiter queue full |
| `E_SEMAPHORE_FULL` | `MAX - 11` | semaphore waiter queue full |
| `E_SEMAPHORE_OVERFLOW` | `MAX - 12` | count would pass its u16 maximum |
| `E_BAD_SEMAPHORE` | `MAX - 13` | semaphore id outside the registry |
| `E_NOT_SUPPORTED` | `MAX - 14` | the board has no physical UART (QEMU), or no store, or the store failed |
| `E_NOCAP` | `MAX - 15` | the caller has no capability for this call |
| `E_NOENT` | `MAX - 16` | the persistent key has no value |
| `E_BUSY` | `MAX - 17` | park while holding a mutex |
| `E_OWNER_DIED` | `MAX - 18` | lock succeeded, but the last owner died holding it (not a failure) |

`E_LOWEST` = `E_OWNER_DIED`. `REFUSED` is an older name for `E_PERM`.
`syscall::error_name` gives the short names used in logs (`EPERM`,
`EAGAIN`, ...).

## WebAssembly capsules

Capsules do not issue SVCs themselves: the WASM interpreter's host imports
(`log_str`, `store_get`, `store_put`, ...) do it for them, and the same
capability mask applies. See `docs/wasm-capsules.md` for the WASM ABI
(imports, memory, fuel).

## Where each call is tested

See `docs/EVIDENCE_MATRIX.md`.
