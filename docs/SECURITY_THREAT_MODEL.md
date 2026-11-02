# Security threat model

What Maataa OS protects against today, and what it does not. Written from
the source at `7b99bdb`; each protection names the file that implements it.
Nothing here is a promise beyond what the code does. Maataa OS is an alpha
for one development board; it has had no outside security review.

## Assets

| Asset | Where |
| --- | --- |
| kernel code and state | flash sectors 0–4, kernel RAM ([memory map](HARDWARE_MEMORY_MAP.md)) |
| which capsules run, and with which rights | signed images in the build and in sector 5 |
| persistent values (boot count, task keys) | store, sectors 6–7 |
| availability | scheduler, watchdog |

## Attackers considered

1. **A faulty or hostile task or capsule** already running on the board.
2. **Someone on the host channel** (USART2 / ST-LINK virtual COM port), who
   can send any frame.
3. **Someone with a copy of the flash** (a dump of sectors 5–7), who can
   change it and write it back, or write it into another board.

Not considered: someone with SWD/JTAG access to a board without read-out
protection (they own the chip), side channels, fault injection, the supply
chain of the toolchain and crates.

## Protections

| Threat | Protection | Source |
| --- | --- | --- |
| a task writes kernel memory or another task's stack | MPU: unprivileged code reaches only its own stack (read/write, no execute) and flash (read/execute); the kernel kills a task that faults (MemManage) | `src/mpu.rs`, `docs/kernel-mpu.md` |
| kernel stack overflow into static data | 256-byte no-access guard above `__sheap` | `src/mpu.rs` (`kernel_guard`) |
| a task calls a service it should not | capability mask: bit N allows SVC N; unallowed and unknown calls return `E_NOCAP` (park, 19, is exempt) | `src/syscall.rs`, `src/sched/mod.rs` ([ABI](ABI_SVC.md)) |
| a task passes the kernel a pointer outside its own memory | the kernel reads a task buffer only if it lies in flash or the caller's stack, and writes one only inside the caller's stack | `src/syscall.rs` |
| a task writes a kernel store key | keys 0–15 are read-only for tasks | `src/storage/persist.rs` (`task_key_allowed`) |
| an unsigned or changed capsule | ed25519 signature over name, module, version and capabilities; a bad image is refused at boot and at install | `crates/maataa-capsule`, `src/installed.rs` |
| a capsule asks for more rights | its capabilities are inside the signed manifest; the kernel grants only those | `crates/maataa-capsule`, `src/capsule_task.rs` |
| an older signed capsule installed over a newer one | version floors kept in kernel store key 2; install refused if `version < installed` | `src/installed.rs` |
| a capsule that loops or runs wild | WASM interpreter: 20,000 fuel per call, call depth 16, bounds-checked memory; a trap ends that call only | `crates/maataa-wasm`, `docs/wasm-capsules.md` |
| a malformed host-channel frame | COBS + CRC-32, payload ≤ 200 bytes; a bad frame is counted and dropped | `crates/maataa-link`, `src/hostlink.rs` |
| a changed or corrupted store record | ChaCha20-Poly1305 over value, key, length and position; the header has its own tag | `crates/maataa-store`, `docs/persistence.md` |
| a store copied to another board | store key derived from the chip's unique id (`0x1FFF_7A10`) | `src/storage/persist.rs` |
| a hung kernel or a stuck fault handler | independent watchdog resets the board; the next boot reports the reset cause and crash record | `src/watchdog.rs`, `src/crash.rs` |
| priority inversion on kernel mutexes | priority inheritance | `src/sched/` (tested on QEMU and host) |

## Known limits

- **Development keys are public.** A default build trusts the development
  capsule key and seals the store with a development master key; both are in
  the source. Such a build proves integrity against people who do not have
  the source, nothing more. The boot report says which key is in use.
- **Release keys are only as secret as the flash.** The release store master
  key is compiled into the kernel. Without read-out protection (RDP), anyone
  with SWD reads it. The project does not set RDP on its board, on purpose.
- **The host channel has no authentication.** Anyone on the UART can read
  status and telemetry, read and write task store keys (16–63), and begin,
  write, commit or remove a capsule. A commit still needs a valid signature
  and version, but `CAPSULE_REMOVE` needs nothing.
- **Same-version reinstall is allowed.** The check is `version < installed`,
  so an attacker with an old signed image of the *same* version can install
  it again.
- **Store rollback.** Restoring an older whole bank is not detected unless
  the `otp-rollback` feature is built, and that feature is off by default and
  never written on the project's board. Records cut off the end of the newest
  bank are not detected at all (`docs/persistence.md`).
- **Task store keys are shared.** Any task may write any key 16–63; there is
  no per-task ownership.
- **The crash record is in RAM.** A power cut loses it; only the reset cause
  survives.
- **Not hardened against:** timing or power side channels, glitching, a
  malicious build machine.

## Out of scope by decision

- OTP writes and RDP on the project's board (irreversible).
- Secure boot of the kernel itself: the ROM bootloader runs whatever is in
  sector 0.
