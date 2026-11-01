# WebAssembly capsules

Every verified capsule whose payload is a WebAssembly program runs in a
capsule task of its own: task 7 and task 8. Each task runs its program in a
small interpreter, on its own stack, with 4 KiB of linear memory. The program
can reach the kernel only through the imports listed below, and each import
is a supervisor call made by that task. So each capsule gets exactly the
capabilities its own signed manifest grants, and when it runs comes from the
same signed image (see [Schedule](#schedule)).

Two such capsules are built in:

| Task | Capsule | Capabilities | Schedule |
| --- | --- | --- | --- |
| 7 | telemetry (`capsules/telemetry.wat`) | write, sleep, store_get, store_put | 3 ticks, 200 ms apart |
| 8 | heartbeat (`capsules/heartbeat.wat`) | write, sleep | 4 ticks, 300 ms apart |

```text
capsule task 7: telemetry
capsule task 8: heartbeat
...
capsule heartbeat: wasm loaded (231 bytes, 2 imports, 4096 bytes of memory)
capsule heartbeat: schedule: 4 ticks every 300 ms (signed manifest)
capsule heartbeat: heartbeat capsule up
kernel: task 8 has no capability for syscall 16
capsule heartbeat: init -> -16 (ENOCAP)
capsule heartbeat: tick 1 -> 1 (6 instructions)
capsule telemetry: wasm loaded (503 bytes, 6 imports, 4096 bytes of memory)
capsule telemetry: schedule: 3 ticks every 200 ms (signed manifest)
capsule telemetry: telemetry capsule up
kernel: task 7 has no capability for syscall 2
capsule telemetry: init -> -16 (ENOCAP)
capsule telemetry: lifetime ticks
capsule telemetry: log 1
capsule telemetry: tick 1 -> 89 (211 instructions)
...
capsule telemetry: tick 3 -> 233 (243 instructions)
capsule heartbeat: tick 4 -> 4 (6 instructions)
capsule telemetry: done
capsule heartbeat: done
```

The two capsules' lines interleave, because the scheduler runs the two tasks
side by side.

What this shows:

- **Strings.** The text comes from the capsule's own data segments in its
  memory, printed through `log_str`.
- **State that survives reboots.** The capsule keeps a lifetime tick count in
  persistent key 32, through `store_get` and `store_put`. The count carries
  on across reboots: 3, 6, 9...
- **Refused calls.** The telemetry capsule's request for the LED is refused,
  because its manifest grants `write`, `sleep`, `store_get` and `store_put`,
  but not `led`. The heartbeat capsule's attempt to write the store is
  refused, because its manifest grants only `write` and `sleep`.

Where the code lives:

- Sources: `capsules/telemetry.wat`, `capsules/heartbeat.wat`.
- Signed images: `assets/capsules/telemetry.mcap`,
  `assets/capsules/heartbeat.mcap`.
- Interpreter: `crates/maataa-wasm`.
- Schedule format: `maataa_capsule::Schedule`.
- Kernel side: `src/kernel.rs` (which capsule gets which task),
  `src/capsule_task.rs` (the task body), and tasks 7 and 8 in `src/main.rs`
  (a 16 KiB stack each, aligned so each forms one MPU region).

## Schedule

A capsule's schedule is a custom section named `maataa` in its WebAssembly
module. The section is part of the payload, so the image's signature covers
it, just as it covers the capabilities. In WebAssembly text:

```wat
(module
  (@custom "maataa" "ticks=3 period_ms=200")
  ...)
```

The section is ASCII `key=value` pairs, separated by spaces, commas,
semicolons or newlines:

| Key | Meaning | Allowed |
| --- | --- | --- |
| `ticks` | how many times to call the `tick` export | 1 to 1000, or 0 for "for as long as the board runs" |
| `period_ms` | sleep between ticks | 10 to 3 600 000 |
| `version` | the capsule's version; a run-time install may not go back to an older one | 0 to 1 000 000 (default 0) |
| `priority` | the capsule task's scheduling level; higher runs first (`docs/engineering/SCHEDULER.md`) | 1 to 4 (default 1) |
| `log` | `ticks` logs every tick's result; `quiet` logs a tick only when its result is negative (an error by convention). Traps, refusals and the capsule's own `log` calls are always logged | `ticks` or `quiet` (default `ticks`) |

The kernel refuses to run a capsule whose section has an unknown key, a key
given twice, or a value out of range. A module with two `maataa` sections is
refused when it is loaded. A module with no `maataa` section gets the default:
one tick, and the boot log says so.

A capsule at level 2 or above must sleep between ticks (it does, with
`period_ms`) or it would keep every lower level from running. When its ticks
are done, or if it is refused, the capsule task parks (syscall 19).

The capsule task then calls `init` once (if the module exports it) and `tick`
on the schedule. The sleep between ticks is a supervisor call too, so a
capsule that ticks more than once needs the `sleep` capability.

## Which capsule gets which task

At boot the kernel verifies the built-in images in a fixed order:
telemetry, heartbeat, control, hostlink. Each verified image whose payload
starts with the WebAssembly magic (`\0asm`) takes the next free capsule task,
7 and then 8, and the boot report says so (`capsule task 7: telemetry`). A
rejected image gets no task. A third WebAssembly capsule would be reported as
`no capsule task free; not started`.

The task is unprivileged and may not read kernel memory, so the kernel hands
it its grant (the capsule's name and image, both in flash) at the base of the
task's own stack, before the scheduler starts. The task reads it first.

## The interpreter

`maataa-wasm` is `no_std` and does not allocate. Every stack is a fixed-size
array:

- 128 operand-stack values
- 32 labels
- 16 nested calls

A module may have up to 32 functions, 8 imports, 8 globals, 24 exports and 8
data segments. Custom sections are skipped, except the `maataa` manifest.

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
  in the capsule task's stack, so the kernel's own buffer checks accept it unchanged.
- **Error codes** reach the program as negative numbers: `ENOCAP` is -16 and
  `ENOENT` is -17.
- **Unknown imports.** A module that imports anything else, or one of these
  with a different type, is refused before it runs.

## Building a capsule

```bash
cargo build --release -p maataa-capsule --features cli
T=target/release/maataa-capsule
# Assembles, checks the module loads in maataa-wasm, and checks its schedule.
$T wasm capsules/telemetry.wat -o target/telemetry.wasm
$T sign --name telemetry --caps write,sleep,store_get,store_put \
   --payload target/telemetry.wasm --dev -o assets/capsules/telemetry.mcap
$T wasm capsules/heartbeat.wat -o target/heartbeat.wasm
$T sign --name heartbeat --caps write,sleep \
   --payload target/heartbeat.wasm --dev -o assets/capsules/heartbeat.mcap
```

To add a capsule to the kernel, add its image to the list in `src/kernel.rs`.

**What the tests check:**

- `smoke-alpha.sh`:
  - the telemetry module loads with 4096 bytes of memory;
  - the greeting string is printed;
  - `init` returns `-16 (ENOCAP)`;
  - the third tick returns 233;
  - telemetry gets task 7 and heartbeat task 8, each with the schedule from
    its own signed section;
  - the heartbeat's store write is refused, and its fourth tick runs.
- Host tests: the schedule parser (every malformed form refused), the
  `maataa` section in the interpreter, and the schedules of the built-in
  images.
- `qemu-persistence-test.sh`: the capsule's own lifetime count reaches 9
  after three boots.
- NUCLEO-F411RE, 2026-10-31: after 14 boots of this build, key 32 in the
  board's flash held 42, three ticks per boot. Read it with
  `python3 scripts/read-board-store.py`.
- NUCLEO-F411RE, 2026-10-31, with two capsule tasks: key 32 went on from 42
  to 54 over the next four boots, so task 7 runs the telemetry capsule on its
  signed schedule next to task 8. After a USB replug, the host channel
  selftest passed (13/13): `STATUS` reported `tasks 7/9 alive`, which is all
  eight tasks plus idle, minus tasks 4 and 5, which the MPU and stack tests
  kill on purpose. So both capsule tasks, 7 and 8, are running. `TELEMETRY`
  reported 4 capsules verified.

## Cost

| Item | Size |
| --- | --- |
| Interpreter, flash | about 15 KB of text |
| Each capsule task's stack (tasks 7 and 8) | 16 KiB, which holds the interpreter's fixed stacks and the 4 KiB capsule memory |

## Limits

- **Two capsule tasks.** Each needs a 16 KiB stack; a third would take
  another 16 KiB of the F411's 128 KiB of RAM and a ninth task slot.
- **One run-time capsule.** Besides the built-in images, one capsule can be
  installed at run time, over the host channel, and runs as task 9 from the
  next boot ([capsules.md](capsules.md#installing-a-capsule-at-run-time)).
- **Fixed entry points.** The task calls the exports `init` and `tick`.
- **4 KiB of memory.** Programs built by compilers that expect a full 64 KiB
  page would need a larger buffer, or must keep their data small.
