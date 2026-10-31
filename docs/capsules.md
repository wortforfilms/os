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
| `capsule_install` | 17 | `capsule_image` | 18 |

`capsule_image` cannot be signed into an image. The kernel adds it only to
task 9, so that task can be handed the run-time capsule's image.

What each task gets in this build:

| Task | Capabilities | Where the mask comes from |
| --- | --- | --- |
| 1 | write, led, sleep, mutex, send | kernel (`src/main.rs`) |
| 2 | write, recv, mutex, semaphore (+ test with `kernel-stack-test`) | kernel |
| 3 | write, send, recv, sleep, semaphore, demo_done, uart_write | kernel. It calls `led` on purpose and must get `ENOCAP`. |
| 4, 5 | write | kernel |
| 6 (host channel) | write, sleep, uart_write, uart_read, host_status, store_get, store_put, capsule_install | **signed** `assets/capsules/hostlink.mcap` |
| 7 (telemetry WebAssembly) | write, sleep, store_get, store_put | **signed** `assets/capsules/telemetry.mcap` |
| 8 (heartbeat WebAssembly) | write, sleep. It asks for `store_put` once and must get `ENOCAP`. | **signed** `assets/capsules/heartbeat.mcap` |
| 9 (run-time capsule, if one is installed) | what its image was signed with, plus `capsule_image` | **signed** image in the capsule area ([below](#installing-a-capsule-at-run-time)) |

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

The payload is recorded and counted against the capsule memory budget. A
verified capsule whose payload is WebAssembly gets a capsule task of its own
(tasks 7 and 8, in the order the kernel lists the images) and runs under its
signed capabilities, on the schedule in its signed `maataa` section
([wasm-capsules.md](wasm-capsules.md)). The telemetry and heartbeat payloads
are WebAssembly; the control and hostlink payloads are descriptors and are
not executed.

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
$T sign --name hostlink --caps write,sleep,uart_write,uart_read,host_status,store_get,store_put,capsule_install \
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
capsule verified: telemetry caps=write,sleep,store_get,store_put
capsule task 7: telemetry
capsule verified: heartbeat caps=write,sleep
capsule task 8: heartbeat
capsule verified: control caps=write,send,recv
capsule verified: hostlink caps=write,sleep,uart_write,uart_read,host_status,store_get,store_put,capsule_install
capsule installed: greeter version 2 caps=write,sleep
capsule task 9: greeter
capsule tamper check: rejected (bad signature)
...
kernel: task 3 has no capability for syscall 2
task 3: led without capability -> ENOCAP
```

The tamper check copies the hostlink image, flips one payload byte, and
verifies the copy. That copy must fail. `smoke-alpha.sh` checks all of these
lines and fails if any built-in capsule is rejected.

## Installing a capsule at run time

A signed WebAssembly capsule can be installed over the host channel, without
reflashing the kernel. It runs from the next boot on, as task 9.

```bash
target/release/maataa-capsule wasm capsules/greeter.wat -o target/greeter.wasm
target/release/maataa-capsule sign --name greeter --caps write,sleep \
   --payload target/greeter.wasm --dev -o assets/capsules/greeter.mcap
target/release/maataa-link --serial /dev/cu.usbmodem11403 capsule-install assets/capsules/greeter.mcap
# installed assets/capsules/greeter.mcap: 293 bytes in 42 ms; it runs from the next boot
target/release/maataa-link --serial /dev/cu.usbmodem11403 capsule-info
# installed: greeter version 2, 293 bytes, caps write,sleep
target/release/maataa-link --serial /dev/cu.usbmodem11403 capsule-remove
```

**Where it lives.** The capsule area: flash sector 5 on the F411
(`0x0802_0000`, 128 KiB; `memory.x` keeps the kernel in sectors 0–4), and
the host file `target/qemu-capsule.bin` in QEMU. One capsule is installed at
a time; its image may be at most 4 KiB. Code: `crates/maataa-store/src/area.rs`
(the area) and `src/installed.rs` (the checks).

**How an install goes.** The host sends `CAPSULE_BEGIN` with the image
length, the image in 192-byte `CAPSULE_WRITE` chunks, then `CAPSULE_COMMIT`
([host-channel.md](host-channel.md)). Task 6 passes each through syscall 17,
which its manifest grants as `capsule_install`. The image goes into a new
entry after the installed one. On commit, the kernel reads it back and
installs it only if all of these hold:

- its signature verifies against the build's capsule key;
- its name is not a built-in capsule's (telemetry, heartbeat, control,
  hostlink);
- its payload is WebAssembly that the interpreter loads, with only the
  known imports and a valid `maataa` section;
- its manifest `version` is not lower than the last version installed under
  the same name.

If any check fails, the kernel logs why
(`capsule install: refused: bad signature`), the host gets `REFUSED`, the
new entry is dropped, and **the installed capsule stays**.

**Power cuts.** Each entry's commit word is written last, and each word is
written only once, from erased flash. A power cut during an install leaves
the previous capsule installed. When the area is full, the next install
first compacts it: the installed image is copied to RAM, the sector erased,
and the image written back. A power cut inside that window loses the
installed capsule, never half of it.

**At boot** the kernel checks the installed image again, with the same
checks, and reports `capsule installed: <name> version <n> caps=…` or
`capsule installed: none`. Task 9 gets the image through syscall 18: the
kernel copies it into the task's own stack, checking it once more, so a
change to the flash after boot is caught too.

**Versions.** `version=N` in the `maataa` section is the capsule's version.
The kernel keeps a version floor for the last three names installed (kernel
key 2), so an older version of one of those cannot be installed afterwards,
not even after a remove. A name that dropped out of the three is no longer
guarded.

## Verification

- QEMU, run-time install (`scripts/qemu-capsule-install-test.sh`, part of
  `smoke-alpha.sh`): greeter is installed and runs as task 9 on its signed
  schedule. An older version of greeter, a tampered image, and an image named
  `heartbeat` are each refused, and greeter keeps running. Then it is
  removed, and the next boot starts no task 9.
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
from 35.6 KB to 82.9 KB of text, out of the 512 KB budget. Checking the
built-in capsules plus the tamper copy finishes before the boot report's first
uptime reading (about 37 ms after boot in QEMU).
