# Operator Escalation

Use this path for release, hardware, quorum, rollback, or destructive flashing concerns.

## Immediate Stop Conditions

Stop and preserve evidence if any of these occur:

- production gate claims GO without hardware-root evidence
- unsigned release manifest is accepted
- operator quorum is bypassed
- rollback drill is marked passed without logs
- flashing target is ambiguous
- telemetry is synthetic but labeled live

## Required Evidence For Escalation

- `release/evidence/governed-production-gate.json`
- `release/evidence/hardware-root-of-trust.json`
- `release/evidence/release-authority.json`
- `release/release-authority/operator-approval-log.json`
- exact command output
- target hardware identifier, if hardware was involved

## Escalation Decision

Default decision is fail closed:

```txt
FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO
```

Only a verified release authority flow may move the system toward release candidate status.
