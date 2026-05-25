# MSAR Appliance Frame Matrix

All commercial appliance traffic maps to seven fixed-width local-only frames.
No frame references raw prototype assets under `assets/html/`.

| Token | Format | Bytes | Source | Destination |
| --- | --- | ---: | --- | --- |
| MOSF | Raw Binary | 40 | Rust Kernel Scheduler Loop | TypeScript KernelDashboard |
| MOSR | Raw Binary | 16 | Fail-Safe Hardware Interrupter | RecoveryConsole |
| MAGV | Bit Vector | 32 | Python Glyph Matrix Parser | Local Memory Asset Registers |
| MABS | Bit Vector | 24 | AI ThreadPool Batch Runner | Workspace CapsuleRegistry |
| TLPS | Structured Array | 64 | Studio Operations Board | Local Database Persistence Layer |
| TLPA | Structured Array | 48 | Local Accounting Ledger | MCA Regulatory Audit Archives |
| PEDG | Structured Array | 32 | Digital Gurukul SPA Interface | Signed Assessment Exporter |

The canonical runtime constants live in `apps/system/frameMatrix.ts`.

`TLPA` and `PEDG` use 4-byte truncated validation blocks in the TypeScript
encoders so the appliance preserves the declared 48-byte and 32-byte commercial
frame boundaries without overrun.
