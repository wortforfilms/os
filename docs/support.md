# Support

Support for Maataa OS follows the PHKD rule: support responses must be pure, honest, verifiable, and evidence-backed.

## Before Asking For Help

Please collect:

- the command you ran
- the exact error output
- your platform and Node version
- whether Electron, Tauri, QEMU, or package verification was involved
- the relevant evidence file from `release/evidence/`

Helpful commands:

```bash
node --version
npm --version
git status --short
npm run typecheck
npm run test
npm run status:matrix
```

## Support Channels

For now, support is local-repository based:

- Use GitHub issues when the repo is connected to GitHub.
- Use `docs/support/support-request-template.md` for offline issue capture.
- Use `docs/support/operator-escalation.md` for release, hardware, or governance blockers.

## Severity Levels

| Level | Meaning | Expected Action |
| --- | --- | --- |
| S0 | Data loss, destructive flash risk, fake GO risk | Stop release work and preserve evidence |
| S1 | Build, test, or governed gate failure | File blocker with command output |
| S2 | UI, docs, or preview flow issue | Capture screenshot or route path |
| S3 | Improvement request | Add context and desired outcome |

## What Support Will Not Do

- claim hardware attestation without real evidence
- bypass operator quorum
- mark production ready from screenshots
- accept fake telemetry
- treat preview packages as certified releases

## Current Production Support Status

```txt
PRODUCTION_READY=false
FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO
SUPPORT_MODE=PREVIEW_AND_LOCAL_VALIDATION
```
