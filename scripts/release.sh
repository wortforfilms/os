#!/bin/bash
# Builds a release kernel for the NUCLEO-F411RE, signed and sealed with
# release keys instead of the public development keys (docs/release.md).
#
#   ./scripts/release.sh            # keys in ~/.maataa (created if missing)
#   MAATAA_KEYS=/path ./scripts/release.sh
#
# Keys (keep them private, never in this repository):
#   capsule-release.seed  ed25519 seed; signs the built-in capsules
#   store-release.key     256-bit master key; seals the persistent store
# Output in dist/: the ELF and a SHA-256, the release-signed built-in images,
# greeter and panini signed for run-time install, and the public key. Nothing is flashed.
set -euo pipefail

VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -n 1)"
KEYS="${MAATAA_KEYS:-$HOME/.maataa}"
DIST="dist/maataa-os-v$VERSION-f411"
SIGN=target/release/maataa-capsule

case "$KEYS" in
    "$PWD"|"$PWD"/*) echo "refusing: keep the keys outside the repository ($KEYS)" >&2; exit 1 ;;
esac

cargo build --release -p maataa-capsule --features cli
mkdir -p "$KEYS"
chmod 700 "$KEYS"
if [ ! -f "$KEYS/capsule-release.seed" ]; then
    (umask 077; "$SIGN" keygen -o "$KEYS/capsule-release.seed")
    echo "created $KEYS/capsule-release.seed"
fi
if [ ! -f "$KEYS/store-release.key" ]; then
    (umask 077; python3 -c 'import secrets; print(secrets.token_hex(32))' >"$KEYS/store-release.key")
    echo "created $KEYS/store-release.key"
fi
PUBKEY="$("$SIGN" pubkey --seed-file "$KEYS/capsule-release.seed")"
STORE_KEY="$(tr -d ' \n' <"$KEYS/store-release.key")"

rm -rf "$DIST"
mkdir -p "$DIST/capsules"
for name in telemetry heartbeat control hostlink greeter panini; do
    "$SIGN" resign "assets/capsules/$name.mcap" --seed-file "$KEYS/capsule-release.seed" \
        -o "$DIST/capsules/$name.mcap"
done
echo "$PUBKEY" >"$DIST/capsule-release.pub"

MAATAA_CAPSULE_PUBKEY="$PUBKEY" MAATAA_STORE_KEY="$STORE_KEY" \
    MAATAA_CAPSULE_DIR="$PWD/$DIST/capsules" \
    RUSTC="${RUSTC:-$(rustup which rustc)}" cargo build --release \
    --target thumbv7em-none-eabihf --no-default-features --features board-f411 \
    --target-dir target/release-build
cp target/release-build/thumbv7em-none-eabihf/release/maataa-os "$DIST/maataa-os.elf"
(cd "$DIST" && { sha256sum maataa-os.elf 2>/dev/null || shasum -a 256 maataa-os.elf; } >maataa-os.elf.sha256)

echo
echo "release $VERSION for the F411 in $DIST:"
ls -l "$DIST" "$DIST/capsules"
echo "capsule public key: $PUBKEY"
echo
echo "Before flashing: this kernel cannot open a store sealed with the development"
echo "key (it reports 'sealed with a different key' and leaves it untouched)."
echo "Erase sectors 6-7 first if the board's store may be lost; see docs/release.md."
