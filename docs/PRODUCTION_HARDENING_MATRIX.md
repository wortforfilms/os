# Production Hardening Matrix

This matrix tracks the requested production requirements for the Maataa Sovereign
AI Runtime, Digital Gurukul, and Radio Vaigyaaniq surfaces.

PHKD rule: do not claim production, scientific certification, live AI, live
collaboration, or hardware trust unless the repository contains executable
evidence for that gate.

## MSAR

| Gate | State | Evidence |
| --- | --- | --- |
| Static sector enforcement | STAGED | Requires `src/storage/flash.rs` plus hardware WP validation. |
| Hardware root of trust | BLOCKED | Synthetic identity exists; HSM/TPM secure boot loop is not integrated. |
| Zero-allocation scheduler | PREVIEW | QEMU alpha is deterministic; heap-free kernel audit remains open. |
| Offline model inference | STAGED | Script matrices are active; Whisper/Piper/SDXL/ONNX weights are placeholders. |
| Loopback pressure recovery | PASS | `TELEMETRY_PRESSURE_REPORT.json` shows rollback and zero packet leakage. |

## Digital Gurukul

| Gate | State | Evidence |
| --- | --- | --- |
| Immutable frame matrix | PASS | `PEDG` and `MSAR` frame registries are frozen at module load. |
| Bundled educational assets | STAGED | Storyboard, style, and audio bundles are not yet committed. |
| Accessibility providers | PREVIEW | Provider skeletons exist; latency evidence is not recorded. |
| Learning analytics ledger | BLOCKED | SQLite storage and cryptographic milestone ledger are not wired. |

## Radio Vaigyaaniq

| Gate | State | Evidence |
| --- | --- | --- |
| Zero-drop audio IPC | STAGED | Radio state is represented; audio packet IPC path is not verified. |
| NCR appliance cluster config | BLOCKED | No Delhi/Noida/Gurugram autonomous deployment matrix is present. |
| Signed flashing gate | PREVIEW | Golden-image signing exists; stronger per-device flashing admission remains open. |

## Verdict

`PRODUCTION_READY=false`

The strongest current surface is the deterministic script matrix plus loopback
pressure verification. Hardware root of trust, real model inference, Gurukul
asset bundling, local learning ledger, and Radio edge deployment remain open.
