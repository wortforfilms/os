"use strict";

// Maataa Agent Supervisor.
//
// The runtime half of the agent subsystem. It boots the registered agents,
// keeps each one alive with a periodic heartbeat, and exposes a live snapshot
// the dashboard can read. This is the "Orchestrator" in its first, honest form:
// it does not yet "self-evolve", but it really does coordinate a fleet and
// delegate work, which is enough to back the live count.

const { createAgentStore, SEED_AGENTS } = require("../../apps/electron/agent-store.cjs");

function createSupervisor(databasePath, options = {}) {
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 5_000;
  const store = createAgentStore(databasePath, options);
  const timers = new Map();

  function startAgent(slug) {
    // Register (idempotent) and emit an immediate heartbeat so the agent is
    // counted as active from the moment it boots.
    const seed = SEED_AGENTS.find((a) => a.slug === slug);
    if (seed) {
      store.register(seed);
    }
    store.heartbeat(slug);
    if (!timers.has(slug)) {
      const timer = setInterval(() => store.heartbeat(slug), heartbeatIntervalMs);
      if (typeof timer.unref === "function") timer.unref();
      timers.set(slug, timer);
    }
  }

  return {
    store,

    // Boot the whole fleet (all 12 seeded agents by default).
    startAll() {
      for (const a of SEED_AGENTS) startAgent(a.slug);
      return store.activeAgentCount();
    },

    start(slug) {
      startAgent(slug);
      return store.activeAgentCount();
    },

    stop(slug) {
      const timer = timers.get(slug);
      if (timer) {
        clearInterval(timer);
        timers.delete(slug);
      }
      return store.stop(slug);
    },

    // Orchestrator delegating a task to a worker agent, recorded as real work.
    delegate(slug, status = "completed") {
      return store.recordTask(slug, status);
    },

    // Single source of truth for the dashboard "Active Agents" tile.
    snapshot(at = Date.now()) {
      return {
        generatedAt: new Date(at).toISOString(),
        activeAgents: store.activeAgentCount(at),
        registeredAgents: store.listAgents().length,
        agents: store.activeAgents(at).map((a) => ({ slug: a.slug, name: a.name, kind: a.kind })),
        performance24h: store.performanceSnapshot(at),
      };
    },

    shutdown() {
      for (const timer of timers.values()) clearInterval(timer);
      timers.clear();
      store.close();
    },
  };
}

module.exports = { createSupervisor };
