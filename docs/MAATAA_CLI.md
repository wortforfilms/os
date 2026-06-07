# MAATAA CLI

`bin/maataa` is a portable Bash CLI for local MAATAA-OS evidence checks. It does not require `npm link`, a global npm install, bundled fonts, OCR, or certification services.

## Install

```bash
chmod +x bin/maataa scripts/install-maataa-cli.sh scripts/uninstall-maataa-cli.sh
scripts/install-maataa-cli.sh
```

The installer creates a symlink at `$HOME/.local/bin/maataa` by default. Pass a directory to install somewhere else:

```bash
scripts/install-maataa-cli.sh /usr/local/bin
```

Uninstall:

```bash
scripts/uninstall-maataa-cli.sh
```

## Status

```bash
maataa status --lang en
maataa status --lang hi
maataa status --lang both
```

Status is read from `COMPLETION_STATUS_MATRIX.json` or `release/evidence/latest.json`. The CLI must not print a GO state unless the evidence file itself says so. Current expected posture remains `CONTROLLED_NO_GO`.

## Fonts And Lipi

```bash
maataa doctor fonts
maataa lipi status
maataa lipi pages
maataa lipi fonts
maataa lipi validate
maataa lipi evidence
maataa lipi transliterate --from brahmi --to devanagari "𑀓 𑀔 𑀕"
```

The CLI prints Unicode Devanagari and Brahmi samples only:

- Devanagari: `अ आ इ ई उ ऊ ए ऐ ओ औ क ख ग नमस्ते`
- Brahmi: `𑀅 𑀆 𑀇 𑀈 𑀉 𑀊 𑀏 𑀐 𑀑 𑀒 𑀓 𑀔 𑀕`

No font files are bundled. If the terminal locale does not look UTF-8, the CLI warns that samples may not render.

Transliteration is deterministic for the supported Brahmi-to-Devanagari character map. Unknown characters become `[UNKNOWN]`. The command does not perform OCR and does not guess missing characters.

## Evidence Commands

```bash
maataa evidence generate
maataa evidence latest
maataa evidence blockers
maataa evidence validate
```

`maataa evidence validate` fails closed with a non-zero exit when required evidence files are missing:

- `COMPLETION_STATUS_MATRIX.json`
- `release/evidence/latest.json`
- `release/evidence/blockers.json`

## Other Local Commands

```bash
maataa milestones run
maataa milestones report
maataa milestones kanban
maataa runtime list
maataa runtime transport
maataa runtime graph
maataa device memory
maataa device trust
maataa themelab report
maataa themelab readiness
maataa themelab entitlements
maataa release matrix
maataa release preview
maataa release gate
maataa doctor
```

Missing evidence is reported as `BLOCKED` or `UNKNOWN`. Hardware trust remains `BLOCKED` unless `release/evidence/hardware-root-of-trust.json` contains real captured evidence with a passing PHKD verdict, zero blockers, and production readiness explicitly true.

## JSON Parsing

The CLI uses `jq` when available. If `jq` is missing, it falls back to local Node.js JSON parsing and then to simple text extraction for narrow top-level fields. This keeps `jq` optional without claiming success when evidence cannot be read.
