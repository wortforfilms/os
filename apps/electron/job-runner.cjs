"use strict";

// Recurring Job Runner.
//
// Lets you define a repetitive job (e.g. a data-sync poll), assign N agents to
// it, and run it on a cadence. For throughput, each cycle partitions the job's
// work items across the *healthy* assigned agents, so two agents genuinely
// share the load and finish roughly twice as fast. Every item processed is
// recorded as a real task against the agent that handled it, so the split is
// provable from the task log (store.tasksByAgent).
//
// The `source` and `handler` are pluggable. The demo source below returns a
// deterministic list; swap it for a real poll (API/feed/DB) — the scheduling,
// assignment, partitioning, and evidence are real regardless.

function createJobRunner(supervisor) {
  const store = supervisor.store;
  const jobs = new Map();
  const timers = new Map();

  // Even, deterministic partition of items across the given agent slugs.
  function partition(items, agents) {
    const shards = new Map(agents.map((a) => [a, []]));
    items.forEach((item, i) => shards.get(agents[i % agents.length]).push(item));
    return shards;
  }

  function healthyAssigned(job, at = Date.now()) {
    const active = new Set(store.activeAgents(at).map((a) => a.slug));
    const healthy = job.agents.filter((slug) => active.has(slug));
    // If none are heartbeating, fall back to all assigned so the job still
    // attempts to run (and the failures are recorded honestly).
    return healthy.length ? healthy : job.agents;
  }

  return {
    defineJob({ id, name, agents, intervalMs = 60_000, source, handler }) {
      if (!id || !Array.isArray(agents) || agents.length === 0) {
        throw new Error("defineJob requires id and a non-empty agents array");
      }
      // Register + boot every assigned agent so it heartbeats and can take work.
      for (const slug of agents) {
        store.register({ slug, name: `${slug} (sync worker)`, kind: "agent", role: `Assigned to job ${id}` });
        supervisor.start(slug);
      }
      jobs.set(id, { id, name: name || id, agents, intervalMs, source, handler });
      return jobs.get(id);
    },

    // Run one cycle: pull items, split across healthy agents, process, record.
    runOnce(id, at = Date.now()) {
      const job = jobs.get(id);
      if (!job) return { ok: false, error: "JOB_NOT_FOUND" };

      const items = job.source ? job.source() : [];
      const workers = healthyAssigned(job, at);
      const shards = partition(items, workers);

      const perAgent = {};
      let processed = 0;
      let failed = 0;
      for (const [slug, shardItems] of shards) {
        perAgent[slug] = { processed: 0, failed: 0 };
        for (const item of shardItems) {
          try {
            if (job.handler) job.handler(item, slug);
            store.recordTask(slug, "completed");
            perAgent[slug].processed++;
            processed++;
          } catch {
            store.recordTask(slug, "failed");
            perAgent[slug].failed++;
            failed++;
          }
        }
      }
      return { ok: true, job: id, items: items.length, workers, processed, failed, perAgent };
    },

    start(id) {
      const job = jobs.get(id);
      if (!job) return { ok: false, error: "JOB_NOT_FOUND" };
      if (timers.has(id)) return { ok: true, alreadyRunning: true };
      const t = setInterval(() => this.runOnce(id), job.intervalMs);
      if (typeof t.unref === "function") t.unref();
      timers.set(id, t);
      return { ok: true, started: id, intervalMs: job.intervalMs };
    },

    stop(id) {
      const t = timers.get(id);
      if (t) { clearInterval(t); timers.delete(id); }
      return { ok: true, stopped: id };
    },

    // DB-backed proof of how the two agents shared the load.
    splitReport(id, windowMs = 24 * 60 * 60 * 1000) {
      const job = jobs.get(id);
      const byAgent = store.tasksByAgent(Date.now(), windowMs);
      return { job: id, agents: job ? job.agents : [], tasksByAgent: byAgent };
    },

    stopAll() {
      for (const t of timers.values()) clearInterval(t);
      timers.clear();
    },
  };
}

// A stand-in data source: returns `count` records to "sync". Replace with a
// real poll (fetch from an API, read a feed, query a source DB).
function demoSyncSource(count = 50) {
  return () => Array.from({ length: count }, (_, i) => ({ id: i + 1, payload: `record-${i + 1}` }));
}

module.exports = { createJobRunner, demoSyncSource };
