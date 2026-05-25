# Maataa OS Build Guide

This guide covers the `v0.1.0-alpha.1` QEMU prototype release.

## Prerequisites
- Rust (stable)
- `thumbv7em-none-eabihf` target
- `qemu-system-arm` for local emulation
- `arm-none-eabi-size` for release size checks
- `probe-rs` for experimental hardware flashing

## Building
```bash
./scripts/build.sh
```

### Required Tools
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add embedded target
rustup target add thumbv7em-none-eabihf

# Install ARM toolchain (macOS)
brew install arm-none-eabi-gcc

# Install QEMU (macOS)
brew install qemu

# Install probe-rs for flashing
cargo install probe-rs --features cli
```

## Run The QEMU Alpha
```bash
./scripts/run.sh
```

The current prototype boots in QEMU, initializes virtual drivers, mounts virtual
flash storage, loads static capsule slots, runs a short scheduler simulation,
and exits through semihosting.

## Release Smoke Test
```bash
./scripts/smoke-alpha.sh
```

## Direct Cargo Commands
```bash
cargo check
./scripts/test-host.sh
cargo build --release
./scripts/sizecheck.sh
```

## Hardware Flashing

`scripts/flash.sh` targets an STM32F411-class board, but hardware validation is
not part of this QEMU alpha release gate.
