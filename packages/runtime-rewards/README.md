# @maataa/runtime-rewards

Sovereign in-memory runtime that turns **verified** agent task-completion into a
**permanent, content-addressed identity** plus **evidence-backed badges**, recorded
in a tamper-evident, rollbackable ledger.

## PHKD scope (honest)

- **Content-addressed IDs.** `mintPermanentId(role, task, artifacts)` derives
  `agent:<role>:<sha12>` purely from the sha256 of each verified output artifact.
  Same verified work → same id, permanently. No random ids; no minting without
  artifacts (fails closed).
- **Fail-closed badges.** A badge is rejected unless every evidence item is
  `verified: true` with a real `artifact` path + `sha256`. No evidence → no badge.
- **Pitra (ancestral) tier.** An agent that completes its foundational task and
  retires carries `lineage: "pitra"`, `retired: true`, **0 next tasks**, and only
  `pitra`-tier badges. The runtime rejects a pitra agent that still holds tasks.
- **Tamper-evident.** The ledger is a hash chain; `validateLedger()` recomputes
  ids, badge hashes, and the chain and reports any mismatch.
- **No authority.** This grants no production-GO, release authority, or trust.
  `__meta.governedProductionGo = false`. It records honest credit only — the
  underlying work must be verified independently (tests, typecheck, evidence).

## API

`mintPermanentId`, `recordReward`, `buildLedger`, `validateLedger`, `health`.

Consumed by `scripts/generate-agent-rewards.mjs`, which builds
`release/evidence/agent-rewards.json` from the verified task artifacts and feeds a
rewards summary into `release/evidence/workers-agents.json`.
