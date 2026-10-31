# WebAssembly capsules

The signed telemetry capsule carries a real WebAssembly program. Task 7 runs
it in a small interpreter on its own stack. The program can reach the kernel
only through the imports below, and each import is a supervisor call made by
task 7. So the capsule gets exactly the capabilities its signed manifest
grants.

```text
capsule telemetry: wasm loaded (271 bytes, 3 imports)
kernel: task 7 has no capability for syscall 2
capsule telemetry: init -> -16 (ENOCAP)
capsule telemetry: log 89
capsule telemetry: tick 1 -> 89 (197 instructions)
...
capsule telemetry: tick 3 -> 233 (229 instructions)
capsule telemetry: done
```

- Source: `capsules/telemetry.wat`.
- Signed image: `assets/capsules/telemetry.mcap`, with caps `write` and
  `sleep`.
- Interpreter: `crates/maataa-wasm`.
- Kernel side: `src/capsule_task.rs`, plus task 7 in `src/main.rs`.

## The interpreter

`maataa-wasm` is `no_std` and does not allocate. Every stack is a
fixed-size array:

- 128 operand-stack values
- 32 labels
- 16 nested calls
- up to 32 functions, 8 imports, 8 globals and 24 exports

At load time it checks every function body. It rejects any instruction
outside the supported subset, and any local, global, function or branch index
that is out of range. It also rejects these WebAssembly features:

- linear memory and data segments
- tables, element segments and `call_indirect`
- start functions
- `i64` and floating point
- block types other than `[]` and `[i32]`
- imports that are not functions

It does run all `i32` arithmetic, comparisons and bit operations; `block`,
`loop`, `if`/`else`, `br`, `br_if`, `br_table` and `return`; calls (including
recursion); and `select`, `drop`, locals and globals.

At run time:

- Each export call has a fuel limit: 20,000 instructions for a capsule call.
- Divide by zero and `INT_MIN / -1` trap, as the specification requires.
- A call deeper than 16, or an operand or label stack that overflows, traps.
- A trap ends that one call. It does not crash the task or the kernel.

**Tests.** `cargo test -p maataa-wasm` has 12 tests:

- every arithmetic and comparison instruction, and the arithmetic traps
- control flow, recursion and globals
- host imports, and the fuel and call-depth limits
- every rejected feature, and out-of-range indices
- truncated modules, and every single-bit corruption of a module (each must
  load-and-run or be rejected, never panic)
- a differential test against wasmi, a full interpreter: random `i32`
  programs must give the same result, or both must trap. The test runs 400
  programs; a one-off run of 20,000 also agreed.

## Imports

| Import | Type | What it does |
| --- | --- | --- |
| `maataa.log` | `(i32)` | syscall 1 (write); prints `capsule <name>: log <value>` |
| `maataa.sleep_ms` | `(i32) -> i32` | syscall 7 (sleep); returns 0 or an error |
| `maataa.led` | `(i32) -> i32` | syscall 2 (LED); returns 0 or an error |

Before running anything, the task checks that every import is one of these,
with this exact type. A module with any other import is refused. Kernel
error codes reach the program as negative numbers; `ENOCAP` is -16.

## Building a capsule

```bash
cargo build --release -p maataa-capsule --features cli
T=target/release/maataa-capsule
$T wasm capsules/telemetry.wat -o target/telemetry.wasm   # assembles, then checks it loads in maataa-wasm
$T sign --name telemetry --caps write,sleep --payload target/telemetry.wasm --dev \
   -o assets/capsules/telemetry.mcap
```

`smoke-alpha.sh` checks four things:

- the module loads
- `init` returns `-16 (ENOCAP)`, because the manifest grants no LED
- the third tick returns 233 (fib(13))
- no built-in capsule is rejected

## Cost

- **Flash:** the interpreter adds about 13 KB of text (QEMU image 82.9 KB to
  96.5 KB).
- **RAM:** task 7 has its own 8 KB stack, aligned to 8 KB so it is one MPU
  region.
- **Time:** in QEMU, one `tick` runs about 200 instructions.

## Limits

- No linear memory, so a capsule cannot pass strings or buffers. It can log
  numbers only. Adding memory needs a RAM budget and a check on every load
  and store.
- The kernel starts one capsule task, and its name and schedule (3 ticks,
  200 ms apart) are fixed in `src/main.rs`. A manifest field for the entry
  points and the period would remove that.
