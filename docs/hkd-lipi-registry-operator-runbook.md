# HKD Lipi Registry Operator Runbook

Status: CONTROLLED_NO_GO
Production ready: false
Runtime enabled rows: 0

## Operator Scope

This runbook covers evidence refresh, artifact audit, review handoff, and production-go refusal for the HKD Lipi Registry. It does not approve runtime enablement and it does not create new script claims.

## Required Checks

- operator-check:seed-immutable: REQUIRED - The 426-row seed must not be mutated by documentation, review, or approval-gate phases.
- operator-check:no-runtime-enable: REQUIRED - No operator action may set hkd_runtime_enabled=true.
- operator-check:no-production-go-without-human-approval: REQUIRED - Production GO requires a human approval artifact and all Phase 15 blockers resolved.
- operator-check:external-review-pending: REQUIRED - External review can be packaged but not treated as completed until reviewer sign-off exists.

## Run Sequence

1. Regenerate phase 12-16 governance artifacts: node scripts/generate-hkd-lipi-registry-phases12-16.mjs
2. Regenerate phase 17-19 governance artifacts: node scripts/generate-hkd-lipi-registry-phases17-19.mjs
3. Run governance tests: node --test tests/hkd-lipi-registry-phases17-19.test.mjs
4. Run runtime API tests: node --experimental-strip-types --test tests/hkd-lipi-registry-runtime.test.ts
5. Run TypeScript check: npx tsc --noEmit

## Stop Conditions

- Any registry seed hash change outside an approved migration.
- Any productionReady=true value in generated registry governance artifacts.
- Any runtimeEnabled value greater than 0.
- Any missing provenance on review, evidence, or approval artifacts.
- Any external reviewer sign-off missing or ambiguous.
- Any human approval artifact missing for production GO.

## Escalation

- Escalate source conflicts to the registry architect before enrichment.
- Escalate HarfBuzz/OpenType fixture gaps to runtime owners before shaping claims.
- Escalate production GO requests to human approvers with the Phase 16 bundle hash attached.
