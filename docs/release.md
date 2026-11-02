# Release builds

A development build (the default) trusts the public development capsule key
and seals the store with a public development key. Its boot report says so:
`capsule signer: development (public seed; integrity only)` and
`... development (public; integrity only) key bound to this chip`. A release
build uses keys only you hold.

## Making one

```bash
./scripts/release.sh
```

The script:

1. creates the keys in `~/.maataa`, if they are missing (`MAATAA_KEYS`
   chooses another directory, which must be outside the repository):
   - `capsule-release.seed`, the ed25519 seed that signs capsules;
   - `store-release.key`, the 256-bit master key that seals the store;
2. re-signs the built-in capsules, and greeter and panini, with the release seed
   (`maataa-capsule resign`: same name, capabilities and payload);
3. builds the F411 kernel with `MAATAA_CAPSULE_PUBKEY`, `MAATAA_STORE_KEY`
   and `MAATAA_CAPSULE_DIR`;
4. writes `dist/maataa-os-v<version>-f411/`: `maataa-os.elf`, its SHA-256,
   the release-signed images and the public key.

It does not flash anything. Back up `~/.maataa`: without the seed you cannot
sign capsules for this kernel, and without the store key no later kernel can
open the store.

The release boot report reads `capsule signer: release key <id>` and
`flash store: sealed with ChaCha20-Poly1305, release key bound to this chip`.
This was checked in QEMU with a throwaway key pair: all built-in capsules
verified, the tamper check rejected the modified image, and the store was
formatted and sealed.

## Flashing it

```bash
probe-rs download --chip STM32F411RETx dist/maataa-os-v0.1.0-alpha.5-f411/maataa-os.elf
probe-rs reset --chip STM32F411RETx
```

A store sealed by a development build is refused (`sealed with a different
key`) and left untouched. To start a fresh store, erase sectors 6–7 (this
loses its values):

```bash
probe-rs erase --chip STM32F411RETx   # whole chip; then flash again
```

Run-time capsules for a release kernel must be signed with the release seed
(`dist/.../capsules/greeter.mcap` and `panini.mcap`, or `maataa-capsule sign
--seed-file`).

## Keeping the keys secret on the board

The store's master key is compiled into the kernel. Anyone who can read the
flash can read it. The F411's read-out protection (RDP level 1) stops that,
but it also stops the probe from reading the flash, so
`scripts/read-board-store.py` no longer works, and removing it erases the
whole chip. This project does not set it; do so only on boards that hold
real data.
