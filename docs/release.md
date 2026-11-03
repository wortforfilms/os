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

1. refuses to run if `dist/maataa-os-v<version>-f411/` already exists
   (bump the version, or remove the directory to rebuild), or if a tag
   `v<version>` exists on a commit other than HEAD. The order is: the
   release commit (version and release notes), then this script, then the
   tag on that commit;
2. reads the keys from `~/.maataa` (`MAATAA_KEYS` chooses another
   directory, which must be outside the repository):
   - `capsule-release.seed`, the ed25519 seed that signs capsules;
   - `store-release.key`, the 256-bit master key that seals the store.

   If either is missing the script stops before building anything, names
   the missing file(s), and creates them only when run as
   `MAATAA_NEW_KEYS=1 ./scripts/release.sh`. This guards against a wrong or
   empty key directory: a new seed is a new capsule signer, and a new store
   key, even with the old seed, can never open a store sealed by the old
   one. (The keys of v0.1.0-alpha.5, the first release-key build, were
   created on 2026-11-02, before this check existed; capsule public key
   `ccc84427...95da`.)
3. re-signs the built-in capsules, and greeter and panini, with the release seed
   (`maataa-capsule resign`: same name, capabilities and payload);
4. builds the F411 kernel with `MAATAA_CAPSULE_PUBKEY`, `MAATAA_STORE_KEY`
   and `MAATAA_CAPSULE_DIR`;
5. writes `dist/maataa-os-v<version>-f411/`: `maataa-os.elf`, its SHA-256,
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
probe-rs download --chip STM32F411RETx dist/maataa-os-v0.1.0-alpha.8-f411/maataa-os.elf
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
