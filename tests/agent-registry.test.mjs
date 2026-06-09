import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createAgentStore, SEED_AGENTS } = require("../apps/electron/agent-store.cjs");
const { createSupervisor } = require("../src/runtime/agent-supervisor.cjs");

function withStore(fn, options) {
  const dir = mkdtempSync(join(tmpdir(), "maataa-agents-"));
  const store = createAgentStore(join(dir, "agents.sqlite"), options);
  try {
    fn(store);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("registry seeds exactly the 12 canonical agents", () => {
  withStore((store) => {
    const agents = store.listAgents();
    assert.equal(agents.length, 12);
    assert.equal(agents.length, SEED_AGENTS.length);
    assert.ok(agents.some((a) => a.slug === "orchestrator"));
    assert.ok(agents.some((a) => a.slug === "lipi"));
  });
});

test("active count is zero until agents actually heartbeat", () => {
  withStore((store) => {
    // Seeded agents are REGISTERED but have never reported in.
    assert.equal(store.activeAgentCount(), 0);
  });
});

test("Active Agents: 12 is backed by real heartbeats, not a constant", () => {
  withStore((store) => {
    for (const a of SEED_AGENTS) {
      assert.equal(store.heartbeat(a.slug).ok, true);
    }
    assert.equal(store.activeAgentCount(), 12);
  });
});

test("agents that stop reporting fall out of the active count", () => {
  withStore(
    (store) => {
      const t0 = Date.now();
      for (const a of SEED_AGENTS) store.heartbeat(a.slug);
      assert.equal(store.activeAgentCount(t0), 12);
      // 60s later, with a 30s TTL and no further heartbeats, none are active.
      assert.equal(store.activeAgentCount(t0 + 60_000), 0);
    },
    { heartbeatTtlMs: 30_000 },
  );
});

test("performance snapshot is computed from the real task log", () => {
  withStore((store) => {
    for (const a of SEED_AGENTS) store.heartbeat(a.slug);
    store.recordTask("research", "completed");
    store.recordTask("research", "completed");
    store.recordTask("research", "completed");
    store.recordTask("guru", "failed");

    const perf = store.performanceSnapshot();
    assert.equal(perf.activeAgents, 12);
    assert.equal(perf.tasksCompleted, 3);
    assert.equal(perf.tasksFailed, 1);
    assert.equal(perf.successRate, 0.75);
  });
});

test("unknown agents and bad task states are rejected", () => {
  withStore((store) => {
    assert.equal(store.heartbeat("nonexistent").ok, false);
    assert.equal(store.recordTask("research", "exploded").ok, false);
  });
});

test("supervisor boots the fleet and reports a live snapshot", () => {
  const dir = mkdtempSync(join(tmpdir(), "maataa-sup-"));
  const sup = createSupervisor(join(dir, "sup.sqlite"));
  try {
    const active = sup.startAll();
    assert.equal(active, 12);
    sup.delegate("orchestrator", "completed");
    const snap = sup.snapshot();
    assert.equal(snap.activeAgents, 12);
    assert.equal(snap.registeredAgents, 12);
    assert.equal(snap.performance24h.tasksCompleted, 1);
  } finally {
    sup.shutdown();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("agent evidence separates local verified, target, and blocked claims", () => {
  const evidence = JSON.parse(readFileSync("release/evidence/agent-runtime.json", "utf8"));

  assert.equal(evidence.claim, "c-active-agents-12");
  assert.equal(evidence.verificationStatus, "PASS");
  assert.equal(evidence.activeAgents, 12);
  assert.ok(evidence.claimSplit.LOCAL_VERIFIED.some((item) => item.includes("heartbeats")));
  assert.ok(evidence.claimSplit.TARGET.some((item) => item.includes("Deployment records")));
  assert.ok(evidence.claimSplit.BLOCKED.some((item) => item.includes("No deployed-agent count")));
  assert.equal(
    evidence.claimSplit.LOCAL_VERIFIED.some((item) => /deployed|marketplace|2\.47M|98\.72/.test(item)),
    false,
  );
});
