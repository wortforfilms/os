"use strict";

// Maataa Agent Registry + Supervisor store.
//
// Backs the "Active Agents" claim (hkd/agent-universe.hkd#c-active-agents-12)
// with a real, durable registry instead of a fabricated constant.
//
// Mirrors the conventions of apps/electron/auth-store.cjs (SQLite-backed,
// seeded with real records, audit log) but uses Node's built-in node:sqlite
// (DatabaseSync) so no native module or external sqlite3 binary is required.
// This is consistent with the repo's `migrate` script, which already runs
// under `node --experimental-sqlite`.

const { randomUUID } = require("node:crypto");
const { existsSync, mkdirSync } = require("node:fs");
const { dirname } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

// An agent counts as "active" if it has emitted a heartbeat within this window.
const HEARTBEAT_TTL_MS = 30_000;
const DEFAULT_PERF_WINDOW_MS = 24 * 60 * 60 * 1000;

const AGENT_STATES = ["REGISTERED", "ACTIVE", "STOPPED"];
const TASK_STATES = ["running", "completed", "failed"];

// The 12 canonical agents, extracted verbatim from the agent-universe vision
// board nodes (hkd/agent-universe.hkd "nodes" array). These are the real
// definitions the "Active Agents: 12" headline refers to.
const SEED_AGENTS = [
  { id: "agent-orchestrator", slug: "orchestrator", name: "Maataa Orchestrator Agent", kind: "orchestrator", role: "Directs / coordinates / optimizes the ecosystem" },
  { id: "agent-guru", slug: "guru", name: "Guru Agent", kind: "agent", role: "Personal mentor & teacher; designs learning paths" },
  { id: "agent-research", slug: "research", name: "Research Agent", kind: "agent", role: "Discovers / analyzes / validates knowledge" },
  { id: "agent-tlp", slug: "tlp", name: "TLP Agent", kind: "agent", role: "Manages The Live Platform; events / speakers / content" },
  { id: "agent-investor", slug: "investor", name: "Investor Agent", kind: "agent", role: "Analyzes opportunities; manages deals / portfolio" },
  { id: "agent-health", slug: "health", name: "Health Agent", kind: "agent", role: "Personalized health companion; monitors / suggests / prevents" },
  { id: "agent-lipi", slug: "lipi", name: "Lipi Agent", kind: "agent", role: "Revives languages & scripts; NLP / OCR / translation" },
  { id: "agent-krishi", slug: "krishi", name: "Krishi Agent", kind: "agent", role: "Smart farming; crop planning / soil health / mandi supply" },
  { id: "agent-child-family", slug: "child-family", name: "Child & Family Agent", kind: "agent", role: "Supports children & families; learning / safety / wellness" },
  { id: "agent-creator", slug: "creator", name: "Creator Agent", kind: "agent", role: "Empowers creators; content / audience / monetization" },
  { id: "agent-governance", slug: "governance", name: "Governance Agent", kind: "agent", role: "Supports policies / voting / transparency" },
  { id: "agent-system", slug: "system", name: "System Agent", kind: "agent", role: "Monitors system health; automates ops; ensures reliability" },
];

function createAgentStore(databasePath, options = {}) {
  const heartbeatTtlMs = options.heartbeatTtlMs ?? HEARTBEAT_TTL_MS;

  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(schemaSql());
  seedAgents(db);

  function now() {
    return Date.now();
  }

  function getAgentRow(idOrSlug) {
    return db
      .prepare("SELECT * FROM agents WHERE (id = ? OR slug = ?) AND disabled_at IS NULL LIMIT 1;")
      .get(idOrSlug, idOrSlug);
  }

  function audit(action, result, actor) {
    db.prepare(
      "INSERT INTO agent_audit (id, action, result, actor, created_at) VALUES (?, ?, ?, ?, ?);",
    ).run(randomUUID(), action, result, actor ?? "system", now());
  }

  const api = {
    databasePath,
    heartbeatTtlMs,

    register({ id, slug, name, kind = "agent", role = "" }) {
      if (!slug || !name) {
        return { ok: false, error: "MISSING_FIELDS" };
      }
      const existing = db.prepare("SELECT id FROM agents WHERE slug = ? LIMIT 1;").get(slug);
      const agentId = existing?.id ?? id ?? `agent-${slug}`;
      const ts = now();
      db.prepare(
        `INSERT INTO agents (id, slug, name, kind, role, state, registered_at, last_heartbeat_at, disabled_at)
         VALUES (?, ?, ?, ?, ?, 'REGISTERED', ?, NULL, NULL)
         ON CONFLICT(slug) DO UPDATE SET name = excluded.name, kind = excluded.kind, role = excluded.role, disabled_at = NULL;`,
      ).run(agentId, slug, name, kind, role, ts);
      audit("agent.register", "PASS", slug);
      return { ok: true, agent: getAgentRow(slug) };
    },

    // A heartbeat is the evidence that an agent process is alive right now.
    heartbeat(idOrSlug) {
      const agent = getAgentRow(idOrSlug);
      if (!agent) {
        return { ok: false, error: "AGENT_NOT_FOUND" };
      }
      db.prepare("UPDATE agents SET last_heartbeat_at = ?, state = 'ACTIVE' WHERE id = ?;").run(now(), agent.id);
      return { ok: true };
    },

    stop(idOrSlug) {
      const agent = getAgentRow(idOrSlug);
      if (!agent) {
        return { ok: false, error: "AGENT_NOT_FOUND" };
      }
      db.prepare("UPDATE agents SET state = 'STOPPED', last_heartbeat_at = NULL WHERE id = ?;").run(agent.id);
      audit("agent.stop", "PASS", agent.slug);
      return { ok: true };
    },

    listAgents() {
      return db.prepare("SELECT * FROM agents WHERE disabled_at IS NULL ORDER BY id;").all();
    },

    // The honest definition of "active": registered, not stopped, and seen
    // within the heartbeat window. No constants.
    activeAgents(at = now()) {
      const cutoff = at - heartbeatTtlMs;
      return db
        .prepare(
          "SELECT * FROM agents WHERE disabled_at IS NULL AND state = 'ACTIVE' AND last_heartbeat_at IS NOT NULL AND last_heartbeat_at >= ? ORDER BY id;",
        )
        .all(cutoff);
    },

    activeAgentCount(at = now()) {
      return api.activeAgents(at).length;
    },

    // Records a unit of work an agent actually performed.
    recordTask(idOrSlug, status = "completed") {
      if (!TASK_STATES.includes(status)) {
        return { ok: false, error: "INVALID_TASK_STATE" };
      }
      const agent = getAgentRow(idOrSlug);
      if (!agent) {
        return { ok: false, error: "AGENT_NOT_FOUND" };
      }
      const ts = now();
      const completedAt = status === "running" ? null : ts;
      db.prepare(
        "INSERT INTO agent_tasks (id, agent_id, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?);",
      ).run(randomUUID(), agent.id, status, ts, completedAt);
      return { ok: true };
    },

    // Real performance numbers derived from the task log — the honest
    // replacement for the fabricated "2.47M tasks / 98.72%" headline.
    performanceSnapshot(at = now(), windowMs = DEFAULT_PERF_WINDOW_MS) {
      const since = at - windowMs;
      const completed = db
        .prepare("SELECT COUNT(*) AS c FROM agent_tasks WHERE status = 'completed' AND created_at >= ?;")
        .get(since).c;
      const failed = db
        .prepare("SELECT COUNT(*) AS c FROM agent_tasks WHERE status = 'failed' AND created_at >= ?;")
        .get(since).c;
      const finished = completed + failed;
      return {
        windowMs,
        activeAgents: api.activeAgentCount(at),
        registeredAgents: api.listAgents().length,
        tasksCompleted: completed,
        tasksFailed: failed,
        successRate: finished === 0 ? null : Number((completed / finished).toFixed(4)),
      };
    },

    // Per-agent task tallies — proves how work was split between agents,
    // straight from the DB rather than an in-memory counter.
    tasksByAgent(at = now(), windowMs = DEFAULT_PERF_WINDOW_MS) {
      const since = at - windowMs;
      const rows = db
        .prepare(
          `SELECT a.slug AS slug, t.status AS status, COUNT(*) AS c
           FROM agent_tasks t JOIN agents a ON a.id = t.agent_id
           WHERE t.created_at >= ? GROUP BY a.slug, t.status;`,
        )
        .all(since);
      const out = {};
      for (const r of rows) {
        out[r.slug] = out[r.slug] || { completed: 0, failed: 0, running: 0 };
        out[r.slug][r.status] = r.c;
      }
      return out;
    },

    close() {
      db.close();
    },
  };

  return api;
}

function seedAgents(db) {
  const ts = Date.now();
  const insert = db.prepare(
    `INSERT INTO agents (id, slug, name, kind, role, state, registered_at, last_heartbeat_at, disabled_at)
     VALUES (?, ?, ?, ?, ?, 'REGISTERED', ?, NULL, NULL)
     ON CONFLICT(slug) DO NOTHING;`,
  );
  for (const a of SEED_AGENTS) {
    insert.run(a.id, a.slug, a.name, a.kind, a.role, ts);
  }
}

function schemaSql() {
  return `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  role TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('REGISTERED', 'ACTIVE', 'STOPPED')),
  registered_at INTEGER NOT NULL,
  last_heartbeat_at INTEGER,
  disabled_at INTEGER
);
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS agent_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created ON agent_tasks (created_at);
CREATE INDEX IF NOT EXISTS idx_agents_heartbeat ON agents (last_heartbeat_at);
`;
}

module.exports = {
  createAgentStore,
  SEED_AGENTS,
  AGENT_STATES,
  TASK_STATES,
  HEARTBEAT_TTL_MS,
};
