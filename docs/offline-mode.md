# Offline Mode

Local-only boundaries:

- Electron blocks non-loopback navigation.
- `assets/html/` is not packaged and must remain untracked.
- Golden-image verification rejects forbidden local/generated artifacts.

Offline AI model inference remains `STAGED`; deterministic script matrices are
active, but model weights are placeholders.
