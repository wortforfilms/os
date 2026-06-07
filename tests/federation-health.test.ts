import { test } from "node:test";
import assert from "node:assert/strict";
import { federationHealth } from "../packages/runtime-federation/src/index.ts";

test("federation health aggregates all runtimes and reports allReady", () => {
  const r = federationHealth();
  assert.ok(r.isOk);
  assert.equal(r.data.runtimes.length, 5);
  for (const rt of r.data.runtimes) assert.equal(rt.status, "ready");
  assert.equal(r.data.allReady, true);
});
