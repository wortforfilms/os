# Agent Subsystem — Architecture

Status: **slice 1 implemented** (registry + supervisor + live count). Broader
fleet capabilities remain on the roadmap and are intentionally still `BLOCKED`.

## Why this exists

The agent-universe vision board asserted operational numbers — `Active Agents: 12`,
`Deployed: 1,248`, `Tasks (24h): 2.47M`, `Success: 98.72%`, a 1,248-agent
marketplace. The governance gate flagged all of them as fabricated because no
agent runtime, supervisor, or registry existed in the repo
(`hkd/agent-universe.hkd`). This subsystem replaces the *first* of those claims
with something real, and leaves the rest honestly blocked.

The guiding rule: **a metric on a dashboard must be readable from a real system,
or it does not ship.**

## Components

| Component | File | Responsibility |
|---|---|---|
| Registry (store) | `apps/electron/agent-store.cjs` | Durable SQLite record of agents, heartbeats, and a task log. Source of truth for "active". |
| Supervisor (runtime) | `src/runtime/agent-supervisor.cjs` | Boots the fleet, keeps each agent alive with periodic heartbeats, delegates tasks, exposes a live snapshot. |
| Evidence generator | `scripts/agent/generate-agent-evidence.mjs` | Boots the supervisor, drives real work, writes `release/evidence/agent-runtime.json`. |
| Tests | `tests/agent-registry.test.mjs` | `node:test` suite (8 cases) proving the count is real, decays, is derived from the task log, and keeps LOCAL_VERIFIED/TARGET/BLOCKED boundaries. |

### Storage choice

Uses Node 22's built-in `node:sqlite` (`DatabaseSync`) rather than a native
module or the `sqlite3` CLI the auth slice shells out to. This keeps the slice
dependency-free and is consistent with the repo's existing
`migrate` script (`node --experimental-sqlite`). The schema mirrors the
auth-store conventions: a primary entity table, a child log table, and an audit
table, all `CREATE TABLE IF NOT EXISTS`.

## Data model

```
agents(id, slug UNIQUE, name, kind, role,
       state ∈ {REGISTERED, ACTIVE, STOPPED},
       registered_at, last_heartbeat_at, disabled_at)

agent_tasks(id, agent_id → agents.id,
            status ∈ {running, completed, failed},
            created_at, completed_at)

agent_audit(id, action, result, actor, created_at)
```

Seeded with the 12 canonical agents taken verbatim from the board's `nodes`
array: orchestrator, guru, research, tlp, investor, health, lipi, krishi,
child-family, creator, governance, system.

## The honest definition of "active"

An agent is **active** iff it is `state = 'ACTIVE'`, not disabled, and its
`last_heartbeat_at` is within `HEARTBEAT_TTL_MS` (30s) of now. Consequences:

- A freshly seeded agent is `REGISTERED` and counts as **0 active** until it
  reports in — so the count cannot be inflated by merely listing agents.
- An agent that stops heartbeating silently **drops out** of the count once the
  TTL lapses. No background sweep or fake liveness.
- `activeAgentCount()` and `performanceSnapshot()` are pure reads over the DB —
  there are no hardcoded numbers anywhere in the path.

## Dashboard wiring

The `Active Agents` tile reads `supervisor.snapshot().activeAgents`. The same
snapshot exposes `performance24h` (`tasksCompleted`, `tasksFailed`,
`successRate`) computed from the real `agent_tasks` log — the honest stand-in
for the fabricated 24h performance panel. When zero tasks have run,
`successRate` is `null`, not a flattering default.

## Governance outcome

`packages/visual-hkd-runtime/src/status-validator.ts` only permits claim
statuses of `BLOCKED | UNVERIFIED | PARTIAL` — by design, a board claim can
never be marked fully "verified" from inside the HKD. So this slice moves the
two now-backed claims to **PARTIAL** with evidence pointers, and leaves the rest
`BLOCKED`:

- `c-active-agents-12`: BLOCKED → **PARTIAL** (live registry backs the count of 12)
- `c-orchestrator-real`: BLOCKED → **PARTIAL** (real supervisor delegates work; not self-evolving)
- Still BLOCKED (correctly): `c-deployed-1248`, `c-tasks-24h-2-47m`,
  `c-success-98-72`, `c-knowledge-nodes-15dam`, `c-perf-24h-tasks`,
  `c-marketplace-1248`, `c-deploy-anywhere`

Net: agent-universe blockers drop from 9 → 7. `productionReady` stays `false`
and the PHKD verdict stays `BLOCKED` — the gate is meant to hold the line, and
it does.

## Roadmap (next honest slices)

1. **Real task execution.** Give agents an actual job to run (e.g. the Lipi
   agent calling the existing `lipi-runtime` package) so `agent_tasks` fills
   with genuine work and the 24h panel becomes real at small scale.
2. **Orchestrator delegation graph.** Implement the board's
   Request→Orchestrate→Delegate→Execute→Review→Deliver flow as real message
   passing between agents, backed by the `edges` in the HKD.
3. **Deployment records.** Only then can `Deployed Agents` reflect a real
   count — one row per deployed instance, per environment.
4. **Marketplace + memory** remain spec-only until 1–3 land.

## Run it

```bash
# Tests
node --experimental-sqlite --test tests/agent-registry.test.mjs

# Regenerate live evidence
node --experimental-sqlite scripts/agent/generate-agent-evidence.mjs
cat release/evidence/agent-runtime.json
```
