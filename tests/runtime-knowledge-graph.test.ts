import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reset, defineEntityType, addEntity, addRelation, query, health,
} from "../packages/runtime-knowledge-graph/src/index.ts";

test("runtime-knowledge-graph: real define/add/relate/query roundtrip", async () => {
  reset();
  const t = await defineEntityType({ name: "Person", schema: { name: "string" } });
  assert.ok(t.isOk);

  const a = await addEntity(t.data!.typeId, { name: "A" });
  const b = await addEntity(t.data!.typeId, { name: "B" });
  assert.ok(a.isOk && b.isOk);

  const rel = await addRelation(a.data!.id, "KNOWS", b.data!.id);
  assert.ok(rel.isOk);

  const all = await query({});
  assert.ok(all.isOk);
  assert.equal(all.data!.length, 1);
  const byType = await query({ type: "KNOWS" });
  assert.equal(byType.data!.length, 1);
  assert.equal(byType.data![0].from, a.data!.id);
});

test("runtime-knowledge-graph: fail-closed validation", async () => {
  reset();
  const unknown = await addEntity("type:Nope", {});
  assert.equal(unknown.isOk, false);
  assert.equal((unknown as { error: { code: string } }).error.code, "unknown_type");

  const dangling = await addRelation("ent-x", "KNOWS", "ent-y");
  assert.equal(dangling.isOk, false);
  assert.equal((dangling as { error: { code: string } }).error.code, "dangling_edge");
});

test("runtime-knowledge-graph: health reports ready (operational, not scaffold)", async () => {
  reset();
  const h = health();
  assert.equal(h.status, "ready");
  assert.equal(h.initialized, true);
  assert.ok(h.capabilities.includes("query"));
  // honesty: still not production-GO
  assert.equal(h.__meta.governedProductionGo, false);
});
