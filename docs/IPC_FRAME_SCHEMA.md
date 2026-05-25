# IPC Frame Schema

Maataa OS native metric frames use a fixed 40-byte little-endian layout. The
frame is local-only and must never reference `assets/html/`.

| Offset | Type | Field |
| --- | --- | --- |
| 0 | u32 | magic `MOSF` |
| 4 | u32 | system uptime ticks |
| 8 | u64 | allocated memory bytes |
| 16 | u32 | active tasks |
| 20 | u16 | hardware cores |
| 22 | u16 | capsule count |
| 24 | u32 | AI batch status word |
| 28 | `[u8; 8]` | reserved padding |
| 36 | u32 | FNV-1a checksum over bytes `0..36` |

Invalid magic, length, checksum, or runtime bounds must route the frontend to
`RecoveryConsole`.
