# IPC Frame Schema

Maataa OS native metric frames use a fixed 40-byte little-endian layout. The
frame is local-only and must never reference `assets/html/`.

| Offset | Type | Field |
| --- | --- | --- |
| 0 | u32 | magic `MOSF` |
| 4 | u16 | schema version |
| 6 | u16 | frame kind |
| 8 | u16 | byte length |
| 10 | u16 | flags |
| 12 | u32 | FNV-1a signature with signature bytes zeroed |
| 16 | u32 | sequence |
| 20 | u16 | host threads |
| 22 | u16 | QEMU engine code |
| 24 | u8 | health code |
| 26 | u16 | script known token count |
| 28 | u16 | script unknown token count |
| 30 | u16 | script weight |
| 32 | u16 | IPC frame count |
| 34 | u32 | capsule bytes |
| 38 | u16 | scheduler ticks |

Invalid magic, version, length, signature, health, or runtime bounds must route
the frontend to `RecoveryConsole`.
