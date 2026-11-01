# Flash and RAM budget

`memory.x` gives the kernel 128 KiB of flash (F411 sectors 0–4); sector 5 is
the run-time capsule area and sectors 6–7 the store. `scripts/sizecheck.sh`
builds all four kernels (F411 and QEMU, release and debug), fails any over
128 KiB, and warns above 90%. The debug builds are the tighter limit, and
CI's smoke test builds them.

## Where it stands (2026-11-01, v0.1.0-alpha.3 + panini)

| Build | Flash (bytes) | Use | Free |
| --- | --- | --- | --- |
| F411 release | 101,376 | 77.3% | 29,696 |
| F411 debug | 119,620 | 91.2% (warning) | 11,452 |
| QEMU debug | 119,388 | 91.0% (warning) | 11,684 |
| QEMU release | 101,544 | 77.4% | 29,528 |

On 2026-10-31 (before priority scheduling, inheritance and the capsule
features) the first three were 97.2, 115.5 and 114.8 KB, and before the two
size changes below 105.7, 121.7 and 121.0 KB.

RAM (F411 release): 84.1 KiB static, of which about 17 KiB is padding: each
task stack is aligned to its own size for its MPU region, which leaves a
15 KB gap between `.data` and `.bss` and 2 KB inside it. 43.9 KiB is left
for the kernel's stack.

## What the F411 release build holds

Code (`.text`, about 69 KB of 97 KB):

| Part | Size |
| --- | --- |
| Kernel (`maataa_os`); `main` alone is 10.5 KB, because the boot report is inlined into it | 23 KB |
| Signature checks: ed25519 (9.7 KB) and `maataa_capsule::verify` with its SHA-512 (5.0 KB) | 15 KB |
| WebAssembly interpreter (`invoke` 6.0 KB, `parse` 4.3 KB) | 12 KB |
| Syscall and fault handlers (`__maataa_svc` 6.0 KB) | 8 KB |
| `core` (mostly formatting) and compiler builtins | 6 KB |
| Store and ChaCha20-Poly1305 | 5 KB |

Constants (`.rodata`, about 25 KB): the log and boot report strings (about
10.6 KB), panic locations (about 5 KB: file, line and column for each place
that can panic), source file paths (1.9 KB), the built-in capsule images
(1.2 KB), and ed25519 tables (1 KB).

RAM (`.bss`, 69.7 KB): three capsule task stacks of 16 KiB (task 9's is
reserved even with no capsule installed), six 2 KiB demo task stacks, and the
4 KiB install scratch buffer (see the RAM line above for what is left).

## Rules that keep it small

- **No `Debug` formatting (`{:?}`) in kernel code.** Formatting a `&str`
  with `Debug` pulls in character escaping and Unicode tables. Four such
  lines cost 5.8 KB; they now print with `Display` (`LoadResult`,
  `StartError::as_str`).
- **The panic handler prints only the location.** Formatting the panic
  message cost 3.0 KB. The crash record keeps the line for the next boot.
- **`opt-level = "z"` for both profiles.** `"s"` is 1.8 KB larger, and
  `3` does not fit at all (about 47 KB larger).
- **ed25519-compact with `opt_size`** (28 KB smaller than without).
- **Debug builds** keep overflow checks but turn off debug assertions.

## What else could be cut

- The alpha.1 boot demos (terminal, comm frame, radio, verification
  self-check, six-tick scheduler simulation): about 4.2 KB on the F411. The
  host channel's TELEMETRY reply depends on the frame the simulation makes,
  so that would need its own source first.
- Deferred logging (for example `defmt`), which keeps the strings off the
  board: probably more than 12 KB, but it needs a host decoder, and QEMU's
  text output would change.

Measure with:

```bash
cargo build --release --target thumbv7em-none-eabihf --no-default-features --features board-f411
llvm-nm --size-sort -S -C --radix=d target/thumbv7em-none-eabihf/release/maataa-os | tail -40
```
