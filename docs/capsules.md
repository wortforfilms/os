# Signed capsules and capabilities

Every task now has a **capability mask**, and the kernel checks it on every
supervisor call. **Signed capsule images** say which capabilities a task gets.
The kernel checks each image's signature at boot and loads only images that
pass, so a capsule's capabilities cannot be raised without the signing key.

- Format and verification: `crates/maataa-capsule`. It is `no_std` and uses
  `ed25519-compact` for signatures.
- Kernel: `src/capsule/mod.rs` (`load_signed`), `src/syscall.rs` (the check
  on each call), `src/kernel.rs` (boot report, tamper check), `src/main.rs`
  (each task's mask).
- Host tool: `maataa-capsule`. Build it with
  `cargo build --release -p maataa-capsule --features cli`.

## Capabilities

Bit *n* of the mask allows supervisor call *n*. A call outside the mask
returns `E_NOCAP`, and the kernel logs
`kernel: task N has no capability for syscall M`. It does this before it looks
at the call's arguments. A task's mask defaults to 0, which allows no calls.

| Name | Calls | Name | Calls |
| --- | --- | --- | --- |
| `write` | 1 | `sleep` | 7 |
| `led` | 2 | `mutex` | 8, 9 |
| `demo_done` | 3 | `semaphore` | 10, 11 |
| `test` | 4 | `uart_write` | 12 |
| `send` | 5 | `uart_read` | 13 |
| `recv` | 6 | `host_status` | 14 |
| `store_get` | 15 | `store_put` | 16 |

What each task gets in this build:

| Task | Capabilities | Where the mask comes from |
| --- | --- | --- |
| 1 | write, led, sleep, mutex, send | kernel (`src/main.rs`) |
| 2 | write, recv, mutex, semaphore (+ test with `kernel-stack-test`) | kernel |
| 3 | write, send, recv, sleep, semaphore, demo_done, uart_write | kernel. It calls `led` on purpose and must get `ENOCAP`. |
| 4, 5 | write | kernel |
| 6 (host channel) | write, sleep, uart_write, uart_read, host_status, store_get, store_put | **signed** `assets/capsules/hostlink.mcap` |
| 7 (telemetry WebAssembly) | write, sleep | **signed** `assets/capsules/telemetry.mcap` |

If the hostlink capsule fails verification, task 6 gets a mask of 0. It then
cannot even log, and stops without making any calls.

## Image format (MCAP, version 1)

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | magic `MCAP` |
| 4 | 1 | format version `1` |
| 5 | 1 | name length, 1..=16 |
| 6 | 2 | reserved, 0 |
| 8 | 4 | capabilities, little-endian |
| 12 | 4 | payload length *L*, little-endian |
| 16 | 16 | name, UTF-8, padded with zeros |
| 32 | *L* | payload |
| 32+*L* | 64 | ed25519 signature over bytes `0..32+L` |

The kernel rejects an image if any of these is true:

- the magic or format version is wrong
- the reserved bytes are not zero
- the name is bad
- the capability bits include ones that no syscall uses
- the payload is longer than 64 KiB
- the length field does not match the image size
- the signature is bad

A test flips each bit of a signed image, one at a time, and checks that every
change is rejected.

The payload is recorded and counted against the capsule memory budget. The
telemetry capsule's payload is WebAssembly, and task 7 runs it under the
capsule's signed capabilities ([wasm-capsules.md](wasm-capsules.md)). The
other two payloads are descriptors and are not executed.

## Keys

The kernel embeds one public key, chosen at build time by `build.rs`:

- **Development (default):** `keys/capsule-dev.pub`. Its private seed,
  `maataa_capsule::DEV_SEED`, is in the source on purpose, so anyone can sign
  with it. A dev-signed image proves the image was not corrupted. It does not
  prove who made it. The boot report says
  `capsule signer: development (public seed; integrity only) key 6dbf55f3`.
- **Release:** set `MAATAA_CAPSULE_PUBKEY` (64 hex characters) when you build.
  The kernel then rejects dev-signed images, and the boot report says
  `capsule signer: release key …`.

```bash
cargo build --release -p maataa-capsule --features cli
T=target/release/maataa-capsule

$T keygen -o ~/.maataa/capsule-release.seed      # private; never commit it
$T pubkey --seed-file ~/.maataa/capsule-release.seed
$T sign --name hostlink --caps write,sleep,uart_write,uart_read,host_status,store_get,store_put \
   --payload hostlink.bin --seed-file ~/.maataa/capsule-release.seed \
   -o assets/capsules/hostlink.mcap
$T inspect assets/capsules/hostlink.mcap --seed-file ~/.maataa/capsule-release.seed
MAATAA_CAPSULE_PUBKEY=<hex> ./scripts/smoke-alpha.sh
```

The committed images in `assets/capsules/` are signed with the development
key. A release build must re-sign them with the release key, or it will reject
them.

## What the boot report shows

```text
capsule signer: development (public seed; integrity only) key 6dbf55f3
capsule verified: telemetry caps=write,sleep
capsule verified: control caps=write,send,recv
capsule verified: hostlink caps=write,sleep,uart_write,uart_read,host_status,store_get,store_put
capsule tamper check: rejected (bad signature)
...
kernel: task 3 has no capability for syscall 2
task 3: led without capability -> ENOCAP
```

The tamper check copies the hostlink image, flips one payload byte, and
verifies the copy. That copy must fail. `smoke-alpha.sh` checks all of these
lines and fails if any built-in capsule is rejected.

## Verification

- QEMU: `smoke-alpha.sh` 10/10. It checks the boot report lines above, the
  `ENOCAP` denial for task 3, and that no built-in capsule is rejected.
- QEMU with a different `MAATAA_CAPSULE_PUBKEY`: all three capsules were
  rejected, task 6 got a mask of 0, and the host channel did not start.
- NUCLEO-F411RE, 2026-10-31: the host channel selftest passed on the signed
  build. TELEMETRY reported 3 capsules and 294 bytes of capsule memory, so all
  three images verified on the board. Every reply came from task 6, whose
  mask comes only from the signed hostlink image.

## Cost

Ed25519 verification adds about 47 KB of flash. The QEMU release image grew
from 35.6 KB to 82.9 KB of text, out of the 512 KB budget. Checking the three
built-in capsules plus the tamper copy finishes before the boot report's first
uptime reading (about 37 ms after boot in QEMU).
