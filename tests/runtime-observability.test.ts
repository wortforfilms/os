import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, report, link, emit, collect, getTopology, getLineage, health } from "../packages/runtime-observability/src/index.ts";

test("runtime-observability: collect aggregates reported statuses", async () => {
  reset();
  report("runtime-knowledge-graph", "ready");
  report("runtime-mission", "ready");
  const agg = await collect([{ runtime: "runtime-knowledge-graph" }, { runtime: "runtime-mission" }, { runtime: "runtime-absent" }]);
  assert.ok(agg.isOk);
  const byR = Object.fromEntries(agg.data!.sources.map((s) => [s.runtime, s.status]));
  assert.equal(byR["runtime-knowledge-graph"], "ready");
  assert.equal(byR["runtime-absent"], "unknown");
});

test("runtime-observability: topology + lineage are real", async () => {
  reset();
  link("runtime-mission", "runtime-knowledge-graph", "reads");
  const topo = await getTopology();
  assert.ok(topo.data!.edges.some((e) => e.from === "runtime-mission" && e.to === "runtime-knowledge-graph"));
  assert.ok(topo.data!.nodes.length >= 2);

  emit("evt-1", "runtime-mission", "assess");
  emit("evt-1", "runtime-knowledge-graph", "query");
  const lin = await getLineage("evt-1");
  assert.equal(lin.data!.chain.length, 2);
  const miss = await getLineage("evt-none");
  assert.equal(miss.isOk, false);
});

test("runtime-observability: health ready, not production-GO", async () => {
  reset();
  report("x", "ready");
  const h = health();
  assert.equal(h.status, "ready");
  assert.equal(h.evidence.reportedRuntimes, 1);
  assert.equal(h.__meta.governedProductionGo, false);
});
