import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reset,
  registerRuntime,
  defineAcl,
  request,
  ledgerSnapshot,
  health,
} from "../packages/runtime-transport/src/index.ts";

test("runtime-transport: allowed requests call registered runtime handlers", async () => {
  reset();
  assert.ok(registerRuntime("runtime-knowledge-graph", {
    query: (pattern) => ({ pattern, rows: 1 }),
  }).isOk);
  assert.ok(defineAcl("runtime-mission", "runtime-knowledge-graph", ["query"]).isOk);

  const result = await request({
    from: "runtime-mission",
    to: "runtime-knowledge-graph",
    method: "query",
    payload: { method: "query", args: [{ type: "KNOWS" }] },
  });

  assert.ok(result.isOk);
  assert.equal(result.data!.decision, "allowed");
  assert.deepEqual(result.data!.response!.result, { pattern: { type: "KNOWS" }, rows: 1 });
  assert.equal(ledgerSnapshot().length, 1);
});

test("runtime-transport: ACL and missing handlers fail closed", async () => {
  reset();
  registerRuntime("runtime-validation", { assess: () => ({ ok: true }) });

  const denied = await request({
    from: "runtime-mission",
    to: "runtime-validation",
    method: "assess",
  });
  assert.equal(denied.data!.decision, "blocked");
  assert.equal(denied.data!.error!.code, "acl_violation");

  defineAcl("runtime-mission", "runtime-validation", ["replicationStatus"]);
  const missing = await request({
    from: "runtime-mission",
    to: "runtime-validation",
    method: "replicationStatus",
  });
  assert.equal(missing.data!.decision, "blocked");
  assert.equal(missing.data!.error!.code, "method_unregistered");
});

test("runtime-transport: cached fallback uses prior successful call signature", async () => {
  reset();
  let fail = false;
  registerRuntime("runtime-observability", {
    collect: () => {
      if (fail) throw new Error("source unavailable");
      return { sources: [{ runtime: "runtime-x", status: "ready" }] };
    },
  });
  defineAcl("governed-production-gate", "runtime-observability", ["collect"]);

  const first = await request({
    from: "governed-production-gate",
    to: "runtime-observability",
    method: "collect",
    payload: { method: "collect", args: [[]] },
  });
  assert.equal(first.data!.decision, "allowed");

  fail = true;
  const fallback = await request({
    from: "governed-production-gate",
    to: "runtime-observability",
    method: "collect",
    payload: { method: "collect", args: [[]] },
    fallback: "cached",
  });
  assert.equal(fallback.data!.decision, "fallback");
  assert.deepEqual(fallback.data!.response!.result, { sources: [{ runtime: "runtime-x", status: "ready" }] });

  const h = health();
  assert.equal(h.status, "ready");
  assert.equal(h.evidence.registeredRuntimes, 1);
  assert.equal(h.evidence.cachedResponses, 1);
  assert.equal(h.__meta.governedProductionGo, false);
});
