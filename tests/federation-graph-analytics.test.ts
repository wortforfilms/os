import { test } from "node:test";
import assert from "node:assert/strict";
import * as fed from "../packages/runtime-federation/src/index.ts";
import * as kg from "../packages/runtime-knowledge-graph/src/index.ts";

// Build a small known graph: a→b→c, a→d (a DAG), reused across tests.
async function dag() {
  kg.reset();
  const t = await kg.defineEntityType({ name: "N", schema: {} });
  const ids: Record<string, string> = {};
  for (const k of ["a", "b", "c", "d"]) ids[k] = (await kg.addEntity(t.data.typeId, { k })).data.id;
  await kg.addRelation(ids.a, "L", ids.b);
  await kg.addRelation(ids.b, "L", ids.c);
  await kg.addRelation(ids.a, "L", ids.d);
  return ids;
}

test("subgraph: BFS reach from seed within depth", async () => {
  const ids = await dag();
  const r1 = await fed.subgraph(ids.a, 1);
  assert.deepEqual(new Set(r1.data.nodes), new Set([ids.a, ids.b, ids.d]));
  const r2 = await fed.subgraph(ids.a, 2);
  assert.equal(r2.data.nodes.length, 4); // reaches c at depth 2
});

test("hasCycle: false on a DAG, true once a back-edge is added", async () => {
  const ids = await dag();
  assert.equal((await fed.hasCycle()).data.cyclic, false);
  await kg.addRelation(ids.c, "L", ids.a); // c→a closes a cycle
  assert.equal((await fed.hasCycle()).data.cyclic, true);
});

test("degreeCentrality: 'a' has highest out-degree", async () => {
  const ids = await dag();
  const r = await fed.degreeCentrality(2);
  assert.equal(r.data.top[0].id, ids.a);
  assert.equal(r.data.top[0].out, 2);
});

test("connectedComponents: one component for the connected DAG", async () => {
  await dag();
  const r = await fed.connectedComponents();
  assert.equal(r.data.count, 1);
  assert.equal(r.data.sizes[0], 4);
});

test("topoOrder: valid order for DAG, fail-closed when cyclic", async () => {
  const ids = await dag();
  const r = await fed.topoOrder();
  assert.ok(r.isOk);
  // a must come before b, c, d
  assert.ok(r.data.order.indexOf(ids.a) < r.data.order.indexOf(ids.b));
  assert.ok(r.data.order.indexOf(ids.b) < r.data.order.indexOf(ids.c));
  await kg.addRelation(ids.c, "L", ids.a);
  assert.equal((await fed.topoOrder()).isOk, false); // cyclic → fail-closed
});
