# Security design: signed host requests and store key ownership

Status: **design note, decisions taken 2026-11-03 (see [Decisions](#decisions)). Nothing here is implemented yet.**
It answers three open items of [SECURITY_THREAT_MODEL.md](SECURITY_THREAT_MODEL.md#known-limits):
`CAPSULE_REMOVE` needs nothing, the host channel has no authentication, and
task store keys 16–63 are shared. Facts about the current code are from
`53c2a3f`; numbers in the proposal are proposals.

## Constraints that shape the design

- **No secret on the board.** The project's board has no read-out
  protection (RDP), by decision, so anything in flash can be read over SWD.
  A shared secret (a token or an HMAC key) would be readable by anyone who
  can read the flash. The board may hold only public keys.
- **No random number generator.** The STM32F411 has no RNG peripheral, so
  the board cannot make unpredictable nonces.
- **No trusted clock.** Uptime restarts at 0 every boot, and the hardware
  build does not ask the host for the time (`hemant anchor: unavailable`).
  Timestamps cannot stop replays.
- **What the board already has:** ed25519 verification
  (`ed25519-compact`, used by `maataa_capsule::verify`), the capsule public
  key built into the kernel (development or release), the chip's 96-bit
  unique id (`0x1FFF_7A10`), and a boot count in kernel key 0 that grows by
  one every boot.
- **Frame size:** a host-channel payload is at most 200 bytes
  ([host-channel.md](host-channel.md)).
- **Wire format:** SLP1 requests in key 40 and answers in key 41 do not
  change.

## Part A: signed host requests (CAPSULE_REMOVE and host authentication)

One mechanism covers both open items: a request that changes the board
carries an ed25519 signature made with the release seed (the same key that
signs capsules, kept in `~/.maataa` on the Mac). The board checks it with
the public key it already has. Nothing secret is on the board, so reading
its flash gives an attacker nothing.

### Challenge

New request `CHALLENGE` (kind `0x0C`, no payload). Reply `0x8C`:

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 12 | chip unique id |
| 12 | 4 | boot count (kernel key 0), little-endian |
| 16 | 4 | sequence number in this boot, little-endian |

The sequence number starts at 0 each boot, lives in RAM, and grows by one
each time a signed request is **accepted**, so one signature works once.
The boot count makes a signature from an earlier boot useless. The chip id
makes a signature for one board useless on another. Nothing is written to
flash for a challenge.

### Signed request

New request `SIGNED` (kind `0x0D`). Payload:

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 64 | ed25519 signature |
| 64 | 1 | operation |
| 65 | n | operation arguments (at most 135 bytes) |

The signature covers `"maataa-host-v1"` (a fixed label, so a capsule
signature can never be taken for a host request), then the 20 challenge
bytes, then the operation byte and its arguments. The board rebuilds the
message from its own current challenge, so the host cannot pick the counter.

| Operation | Arguments | Replaces |
| --- | --- | --- |
| 1 remove capsule | the installed capsule's name | `CAPSULE_REMOVE` (`0x0A`) |
| 2 store put | key, value (at most 64 bytes) | `STORE_PUT` (`0x06`) to keys a signed request is needed for (Part B) |
| 3 commit install | the 64-byte signature of the capsule image already sent with `CAPSULE_BEGIN` / `WRITE` | `CAPSULE_COMMIT` (`0x09`) |

Why the commit needs a signature, although the image is signed: version
floors are kept per capsule name, so without it anyone on the UART could
replace the installed capsule with any other validly signed one (greeter
over panini, say). A downgrade of the same name is already refused by the
floor, and re-installing the same image stays allowed (threat model).

Results: success replies like the request it replaces. A wrong signature,
an old sequence number or a wrong name gives `ERROR 9` (refused) and does
not advance the sequence number.

### What stays unsigned

- Read-only requests: `PING`, `STATUS`, `TELEMETRY`, `INFO`, `STORE_GET`,
  `CAPSULE_INFO`, `CHALLENGE`.
- `CAPSULE_BEGIN` / `WRITE`: they only fill the pending slot. An unfinished
  install leaves the installed capsule (smoke check 12). Only the commit is
  signed (operation 3): the capsule's own signature names the image
  exactly, so the board needs no extra hash.
- `STORE_PUT` to the keys the host shares with a capsule (40, 41 for panini)
  and to a small host scratch range (Part B), so `maataa-link sandhi` and
  the selftest keep working without a signature.

### Host side

`maataa-link capsule-remove --seed-file ~/.maataa/capsule-release.seed`
(and the same for `capsule-install` and a signed `put`; `--dev` for a
development kernel) asks for a challenge, signs, and sends. Signing
stays on the Mac; `release.sh`'s rule holds: never from the cloud or the VM.
`maataa-capsule` already reads that seed file.

### Development builds

A development kernel trusts the development key, whose seed is public in the
source. On such a kernel anyone can sign requests. That is the same as for
capsules today: a development build proves integrity only against people
without the source. The boot report already says which key is in use.

### What changes in tests

- `capsule-install` and `capsule-remove` in
  `scripts/qemu-capsule-install-test.sh` and `scripts/qemu-panini-test.sh`
  sign with the development seed (`--dev`), as the images already are
  dev-signed; the same for `Board capsule install.command` and the panini
  installs on the (development) board.
- New QEMU check: a commit of greeter over an installed panini without a
  signature is refused, and panini keeps running.
- New QEMU checks: remove without a signature refused, a signature replayed
  after acceptance refused, a signature for another boot refused.
- Unit tests: message layout, label, sequence handling.

### Cost

About 30 lines of message building in `crates/maataa-link`, a request
handler in `src/hostlink.rs`, and the check itself in the kernel, behind a
new `CAPSULE_INSTALL` operation (and a signed variant of `STORE_PUT`). The
check belongs in the kernel, not in task 6: the remove and the protected
store writes are supervisor calls, and if task 6 did the check, any task
holding the same capability could make them without a signature. ed25519
is already linked, so the kernel grows by the handler only.

## Part B: store keys owned by capsule name

Today any task with the store capability may write any key 16–63, and read
any key 0–63 (`task_key_allowed`, `task_key_readable` in
`src/storage/persist.rs`).

### Who uses which key now

| Keys | User |
| --- | --- |
| 0–3 | kernel: boot count, reset record, capsule version floors, starvation episodes (4–15 unused) |
| 20 | host selftest (put, get, delete) |
| 30 | QEMU persistence test |
| 32 | telemetry capsule: lifetime tick count |
| 40, 41 | panini request and answer (wire format); `Board persistence check.command` also writes 40 |
| 63 | `maataa-link store-stress` |

The demo tasks 1–5 have no store capability. Writers are task 6 (host
channel) and the capsule tasks 7, 8 and 9.

### Proposal

Ownership goes by the **signed capsule name**, not the task number, because
task 9 runs whichever capsule is installed. The table is a constant in the
kernel.

| Keys | Owner | Writers | Readers |
| --- | --- | --- | --- |
| 0–15 | kernel | kernel | kernel; host (`get`, for boot info) |
| 16–31 | host scratch | host channel | host channel |
| 32–35 | `telemetry` | telemetry | telemetry, host |
| 36–39 | reserved (heartbeat and greeter have no store capability today) | — | — |
| 40–41 | `panini`, shared with the host | panini writes 41; host writes 40 | both |
| 42–47 | `panini` | panini | panini, host |
| 48–62 | unassigned (a future capsule gets a range in the table) | — | — |
| 63 | host scratch (`store-stress`) | host channel | host channel |

- A capsule reading or writing outside its range gets `E_PERM`.
- The host writes its scratch keys and key 40 without a signature; any other
  key 16–63 needs a signed `store put` (Part A).
- The persistence check's use of key 40 moves to a host scratch key, so it
  no longer overwrites a panini request.

### What changes in tests

- New unit tests for the table (each owner in and out of range).
- Telemetry (key 32), panini (40/41) and the host tests (20, 30, 63) keep
  their keys, so smoke checks 8, 11, 13 and 15 should pass unchanged; this
  is the main thing to verify.

## Order of work, once approved

1. Part B (smaller, local to the store calls).
2. Part A: challenge, signed remove, signed commit, then signed store put.
3. Threat model updated after each, with the board run that shows it.

## Decisions

Taken by the user on 2026-11-03.

1. **Install needs a signed commit** (operation 3 above). The reason is
   the cross-name replacement, not a replay of the same image.
2. **Reads stay unsigned, for every key 0–63.** The store holds no
   secrets by design (no secret can be on a board without RDP), and anyone
   with the board can read the whole flash over SWD anyway. Restricting
   `STORE_GET` would only break `boot-info` (keys 0, 1), `board-test.sh`
   and the selftest (key 3). Confidentiality of store data against someone
   on the UART is not a goal; the threat model says so.
3. **One release seed** signs capsules and host requests. The label
   `"maataa-host-v1"` and the operation byte keep the two kinds of
   signature apart. A separate key later would mean a second public key in
   the kernel (a kernel change); the wire format would stay.
