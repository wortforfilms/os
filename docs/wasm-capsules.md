# WebAssembly capsules

The signed telemetry capsule carries a real WebAssembly program. Task 7 runs
it in a small interpreter, on task 7's own stack, with 4 KiB of linear memory.
The program can reach the kernel only through the imports listed below, and
each import is a supervisor call made by task 7. So the capsule gets exactly
the capabilities its signed manifest grants.

```text
capsule telemetry: wasm loaded (473 bytes, 6 imports, 4096 bytes of memory)
capsule telemetry: telemetry capsule up
kernel: task 7 has no capability for syscall 2
capsule telemetry: init -> -16 (ENOCAP)
capsule telemetry: lifetime ticks
capsule telemetry: log 4
capsule telemetry: tick 1 -> 89 (211 instructions)
...
capsule telemetry: tick 3 -> 233 (243 instructions)
capsule telemetry: done
```

What this shows:

- **Strings.** The text comes from the capsule's own data segments in its
  memory, printed through `log_str`.
- **State that survives reboots.** The capsule keeps a lifetime tick count in
  persistent key 32, through `store_get` and `store_put`. The count carries
  on across reboots: 3, 6, 9...
- **Refused calls.** The capsule's request for the LED is refused, because
  the manifest grants `write`, `sleep`, `store_get` and `store_put`, but not
  `led`.

Where the code lives:

- Source: `capsules/telemetry.wat`.
- Signed image: `assets/capsules/telemetry.mcap`.
- Interpreter: `crates/maataa-wasm`.
- Kernel side: `src/capsule_task.rs`, plus task 7 in `src/main.rs` (a 16 KiB
  stack, aligned so it forms one MPU region).

## The interpreter

`maataa-wasm` is `no_std` and does not allocate. Every stack is a fixed-size
array:

- 128 operand-stack values
- 32 labels
- 16 nested calls

A module may have up to 32 functions, 8 imports, 8 globals, 24 exports and 8
data segments.

**What it supports:**

- every `i32` arithmetic, comparison and bit instruction;
- `block`, `loop`, `if`/`else`, `br`, `br_if`, `br_table`, `return` and calls
  (including recursion);
- `select`, `drop`, locals and globals;
- one linear memory, with active data segments, `i32.load`,
  `i32.load8/16_s/u`, `i32.store`, `i32.store8/16`, `memory.size` and
  `memory.grow`.

**Memory is bounded by the host.** The kernel passes a 4 KiB buffer from task
7's stack. The module sees at most that much of its declared memory:

- any access past the buffer traps, even inside the declared page;
- `memory.size` reports the declared minimum;
- `memory.grow` always fails (returns -1);
- a module whose data segments do not fit the buffer is refused before it
  runs.

This differs from the WebAssembly specification, where a page is always 64
KiB. That is deliberate, so that a capsule fits in a small RAM.

**Rejected at load:**

- tables and `call_indirect`
- start functions
- `i64` and floating point, including their loads and stores
- passive data segments
- imported memories or globals
- block types other than `[]` and `[i32]`
- alignment larger than natural
- a memory instruction in a module with no memory
- any out-of-range local, global, function or branch index

**At run time:**

- Each export call has a fuel limit of 20,000 instructions.
- These all trap: divide by zero, `INT_MIN / -1`, a call deeper than 16,
  stack overflow, and memory out of bounds.
- A trap ends that call only. It does not stop the task or the kernel.

**Tests** (`cargo test -p maataa-wasm`, 17 tests):

- every arithmetic and memory instruction, including sign and zero extension
  and static offsets;
- out-of-bounds accesses past the host buffer, and data segments that do not
  fit it;
- a host that reads and writes strings in memory;
- every rejected feature;
- truncated modules, and every single-bit corruption of a module;
- two differential tests against wasmi, a full interpreter:
  - random `i32` programs: 400 per run, and a one-off run of 20,000;
  - random stores and loads over a full 64 KiB page, including addresses at
    and past the end: 300 per run, and a one-off run of 20,000.
  
  In each, both interpreters must give the same result, or both must trap.

## Imports (module `maataa`)

| Import | Type | Supervisor call |
| --- | --- | --- |
| `log` | `(i32)` | 1 write: `capsule <name>: log <value>` |
| `log_str` | `(ptr, len)` | 1 write: `capsule <name>: <text>`, UTF-8 from memory |
| `sleep_ms` | `(i32) -> i32` | 7 sleep; 0 or an error |
| `led` | `(i32) -> i32` | 2 LED; 0 or an error |
| `store_get` | `(key, ptr, cap) -> i32` | 15; the value's length, or an error |
| `store_put` | `(key, ptr, len) -> i32` | 16; 0 or an error |

- **Pointer checks.** Before any call, each pointer and length is checked
  against the capsule's memory buffer; one outside it traps. The buffer lies
  in task 7's stack, so the kernel's own buffer checks accept it unchanged.
- **Error codes** reach the program as negative numbers: `ENOCAP` is -16 and
  `ENOENT` is -17.
- **Unknown imports.** A module that imports anything else, or one of these
  with a different type, is refused before it runs.

## Building a capsule

```bash
cargo build --release -p maataa-capsule --features cli
T=target/release/maataa-capsule
$T wasm capsules/telemetry.wat -o target/telemetry.wasm   # assembles, then checks it loads in maataa-wasm
$T sign --name telemetry --caps write,sleep,store_get,store_put \
   --payload target/telemetry.wasm --dev -o assets/capsules/telemetry.mcap
```

**What the tests check:**

- `smoke-alpha.sh`:
  - the module loads with 4096 bytes of memory;
  - the greeting string is printed;
  - `init` returns `-16 (ENOCAP)`;
  - the third tick returns 233.
- `qemu-persistence-test.sh`: the capsule's own lifetime count reaches 9
  after three boots.
- NUCLEO-F411RE, 2026-10-31: after 14 boots of this build, key 32 in the
  board's flash held 42, three ticks per boot. Read it with
  `python3 scripts/read-board-store.py`.

## Cost

| Item | Size |
| --- | --- |
| Interpreter, flash | about 15 KB of text |
| Task 7 stack | 16 KiB, which holds the interpreter's fixed stacks and the 4 KiB capsule memory |

## Limits

- **One capsule task.** The kernel starts only the telemetry capsule, and its
  name and schedule (3 ticks, 200 ms apart) are fixed in `src/main.rs`.
  Manifest fields for the entry points and the period would remove that.
- **4 KiB of memory.** Programs built by compilers that expect a full 64 KiB
  page would need a larger buffer, or must keep their data small.
