# Host channel

The host channel lets a computer talk to a running Maataa OS kernel over
USART2. It replaces the UART echo demo of task 2.

- Kernel side: `src/hostlink.rs`. Task 6 serves the channel. It runs
  unprivileged and uses supervisor calls only: 12 (UART write), 13 (UART read,
  blocks until bytes arrive), and 14 (status block). Its capability mask
  comes from the signed capsule `assets/capsules/hostlink.mcap`
  ([capsules.md](capsules.md)).
- Shared codec: `crates/maataa-link`. It is `no_std`, does not allocate, and
  is used by both the kernel and the host tool.
- Host tool: `maataa-link`. Build it with
  `cargo build --release -p maataa-link --features cli`.

## Where the channel runs

| Board | Transport | Kernel logs |
| --- | --- | --- |
| QEMU `netduinoplus2` | QEMU's USART2 model, the second `-serial` device | semihosting (separate) |
| NUCLEO-F411RE | ST-LINK virtual COM port (USART2, PA2/PA3), 115200 8-N-1 | the same UART |

On the F411 the kernel's text log and the frames share the same wire. Each
frame starts and ends with a `0x00` byte, and log text never contains one. So
a log line always lands in a chunk of its own. That chunk fails its CRC, and
the host tool counts and skips it.

## Frame format

The format is protocol version 1. Each frame on the wire is
`0x00, COBS(body), 0x00`. The body is:

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 1 | protocol version, `1` |
| 1 | 1 | kind |
| 2 | 1 | sequence number; the reply echoes it |
| 3 | n | payload, at most 200 bytes |
| 3+n | 4 | CRC-32 (IEEE, same as zlib) over bytes `0..3+n`, little-endian |

A whole frame is at most 210 bytes, so one UART syscall (limit 256) carries
it.

## Messages

| Request | Kind | Payload | Reply | Reply payload |
| --- | --- | --- | --- | --- |
| PING | `0x01` | up to 64 bytes | PONG `0x81` | the same bytes |
| STATUS | `0x02` | none | `0x82` | 32 bytes, see below |
| TELEMETRY | `0x03` | none | `0x83` | the latest 40-byte MOSF frame ([IPC frame schema](IPC_FRAME_SCHEMA.md)) |
| INFO | `0x04` | none | `0x84` | `[version, len, board…, len, kernel version…]` |

The kernel sends **HELLO** (`0x80`, same payload as INFO, sequence 0) once,
when the channel starts.

When a request fails, the reply is **ERROR** (`0xFF`), with payload
`[code, request kind]`:

| Code | Meaning |
| --- | --- |
| 1 | bad CRC (sequence 0, request kind 0: the header could not be trusted) |
| 2 | unsupported protocol version |
| 3 | unknown request kind |
| 4 | bad payload length |
| 5 | frame too long |
| 6 | not available (no telemetry yet) |
| 7 | bad COBS encoding |

STATUS payload (little-endian):

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 8 | uptime, ns (kernel monotonic clock) |
| 8 | 8 | ticks |
| 16 | 4 | tick rate, Hz |
| 20 | 4 | core clock, Hz |
| 24 | 4 | UART receive bytes dropped (FIFO full) |
| 28 | 1 | tasks alive |
| 29 | 1 | tasks total, including the idle task |
| 30 | 2 | clock regressions |

## Syscall 14

`host_status(&mut [u8; 76])` copies the status block into the caller's own
stack. The kernel refuses a buffer anywhere else, and a buffer of any other
length. The block is laid out as:

```text
[STATUS payload; 32] [telemetry present: u8] [0; 3] [MOSF frame; 40]
```

## Running it

QEMU (part of `./scripts/smoke-alpha.sh`):

```bash
./scripts/qemu-host-channel-test.sh
```

QEMU starts with USART2 on a Unix socket and waits for the tool to connect,
so the HELLO frame is never lost. The tool then runs `selftest`:

- PING with text, then a 64-byte binary PING that contains zeros
- STATUS, TELEMETRY and INFO
- a frame with one byte flipped, which must be rejected with a bad CRC
- an unknown request kind, which must be rejected
- a final PING, to show the channel still works

Board (NUCLEO-F411RE, already flashed): double-click
`Board host channel.command`, or run:

```bash
cargo build --release -p maataa-link --features cli
target/release/maataa-link --serial /dev/cu.usbmodem1103 selftest
target/release/maataa-link --serial /dev/cu.usbmodem1103 status
```

The board sends HELLO once, at boot. A tool that connects later sees no HELLO
and goes on without it. Close any serial terminal on the port first.

## Verification

- QEMU 8.2 (Linux) and QEMU on macOS: `smoke-alpha.sh` 10/10, including
  `qemu-host-channel-test.sh`. All selftest checks passed.
- NUCLEO-F411RE, 2026-10-31, `/dev/cu.usbmodem11403`, run with
  `Board host channel.command` about 100 s after flashing. Every selftest
  check passed, with round trips of about 12 ms.
  - STATUS reported uptime 99.609 s at a 100 MHz core clock, which matches the
    wall-clock time since the flash. It also reported 5 of 7 tasks alive
    (tasks 4 and 5 are killed by design), 0 UART bytes dropped and 0 clock
    regressions.
  - TELEMETRY returned a MOSF frame whose checksum matched.
  - INFO reported `stm32f411`.
  - No HELLO was seen, as expected: it is sent at boot, before the tool
    connected.

## Limits

- One reader only. Task 6 owns USART2 RX; no other task may call syscall 13.
- On the F411, a kernel log written from an exception handler while task 6 is
  in the middle of a frame write could split that frame. The host would then
  see a bad CRC and time out on that request. Fault messages normally appear
  only at boot (tasks 4 and 5).
- There is no flow control. The receive FIFO is 256 bytes, and the STATUS
  reply counts any bytes it dropped.
