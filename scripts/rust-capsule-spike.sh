#!/bin/bash
# Step 0 spike: build the Rust capsule in spikes/rust-capsule for
# wasm32v1-none and run it in our interpreter (crates/maataa-wasm) with a
# capsule task's 4 KiB of memory and fuel limit.
# Pass: the module loads (no instruction outside the i32 subset), its
# schedule section is there, and init, tick and check_reply match the host.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

rustup target add wasm32v1-none >/dev/null
( cd spikes/rust-capsule && cargo build --release )
WASM="$PWD/spikes/rust-capsule/target/wasm32v1-none/release/rust_capsule_spike.wasm"
echo "built: $(wc -c <"$WASM") bytes"
RUST_CAPSULE_WASM="$WASM" cargo test -p maataa-wasm --test rust_capsule_spike -- --nocapture
