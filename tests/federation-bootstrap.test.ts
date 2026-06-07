import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrap } from "../packages/runtime-federation/src/index.ts";
import * as observability from "../packages/runtime-observability/src/index.ts";

test("federation bootstrap reports runtime health + links topology", () => {
  observability.reset();
  const r = bootstrap();
  assert.ok(r.isOk, JSON.stringify(r.error));
  assert.ok(r.data.nodes >= 5, `nodes=${r.data.nodes}`);
  assert.ok(r.data.edges >= 4, `edges=${r.data.edges}`);
  const topo = observability.getTopology();
  assert.ok(topo.data.edges.some((e) => e.from === "runtime-validation" && e.to === "runtime-hkd-registry"));
});
