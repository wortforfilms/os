# Flash and RAM budget

`memory.x` gives the kernel 128 KiB of flash (F411 sectors 0–4); sector 5 is
the run-time capsule area and sectors 6–7 the store. `scripts/sizecheck.sh`
builds all six kernels (F411, F446 and QEMU, release and debug), fails any over
128 KiB, and warns above 90%. The debug builds are the tighter limit, and
CI's smoke test builds them.

## Where it stands (2026-11-07, board-f446 added)

| Build | Flash (bytes) | Use | Free |
| --- | --- | --- | --- |
| F411 release | 111,880 | 85.4% | 19,192 |
| F411 debug | 117,412 | 89.6% | 13,660 |
| F446 release | 112,036 | 85.5% | 19,036 |
| F446 debug | 117,588 | 89.7% | 13,484 |
| QEMU debug | 116,624 | 89.0% | 14,448 |
| QEMU release | 111,276 | 84.9% | 19,796 |

The F411 and QEMU rows are the 2026-11-06 measurements below; this change
does not alter those builds. The F446 rows are estimates: in a cloud build
with `-Zbuild-std` (smaller absolute sizes) the F446 kernels came out 156
bytes (release) and 176 bytes (debug) above the F411 ones, added here to the
Mac's F411 numbers. Replace them with the Mac's `scripts/sizecheck.sh`
output. The F446 debug build is about 380 bytes under the 90% warning, so
the driver commits will cross it: decide then what leaves the debug build.

## Earlier: 2026-11-06, v0.1.0-alpha.9, rustc 1.91.0

| Build | Flash (bytes) | Use | Free |
| --- | --- | --- | --- |
| F411 release | 111,880 | 85.4% | 19,192 |
| F411 debug | 117,412 | 89.6% | 13,660 |
| QEMU debug | 116,624 | 89.0% | 14,448 |
| QEMU release | 111,276 | 84.9% | 19,796 |

Measured with `scripts/sizecheck.sh` on the Mac. The signed release ELFs in
`dist/` agree: v0.1.0-alpha.9 F411 is 111,780 bytes (text 110,460 + data
1,320) and alpha.8 111,472, so the builds grew by about 7 KB between the
2026-11-03 table below and alpha.8. The F411 debug build is 0.4 points
under the 90% warning.

## Earlier: 2026-11-03, after alpha.7 + signed host requests

| Build | Flash (bytes) | Use | Free |
| --- | --- | --- | --- |
| F411 release | 104,612 | 79.8% | 26,460 |
| F411 debug | 110,268 | 84.1% | 20,804 |
| QEMU debug | 110,648 | 84.4% | 20,424 |
| QEMU release | 105,004 | 80.1% | 26,068 |

The debug builds were at 90.2% and 90.4% (warning) after signed host
requests; building third-party crates without overflow checks in debug
builds took 8 KB off both (rule below).

## Earlier: 2026-11-01, v0.1.0-alpha.3 + panini

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
- **Debug builds** keep overflow checks in the kernel and the workspace
  crates, but turn off debug assertions, and third-party crates (ed25519,
  ChaCha20-Poly1305, the HAL) build without overflow checks, as in release
  (`[profile.dev.package."*"]` in `Cargo.toml`): 8 KB on the F411.

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
