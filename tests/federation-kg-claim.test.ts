import { test } from "node:test";
import assert from "node:assert/strict";
import { submitKgClaim } from "../packages/runtime-federation/src/index.ts";
import * as kg from "../packages/runtime-knowledge-graph/src/index.ts";
import * as validation from "../packages/runtime-validation/src/index.ts";

test("KG → validation: create entity then submit it as a validation claim", async () => {
  kg.reset();
  validation.reset();
  const t = await kg.defineEntityType({ name: "Claim", schema: { text: "string" } });
  assert.ok(t.isOk);
  const r = await submitKgClaim(
    t.data.typeId,
    { text: "water boils at 100C at 1atm" },
    [{ ref: { runtime: "runtime-hkd-registry", id: "art-1" }, weight: 4 }],
    { approach: "experiment", preregistered: true, notes: "" },
  );
  assert.ok(r.isOk, JSON.stringify(r.error));
  assert.match(r.data.entityId, /^ent-/);
  assert.match(r.data.validationId, /^val-/);
});

test("KG → validation: fails closed on unknown entity type", async () => {
  kg.reset();
  validation.reset();
  const r = await submitKgClaim("type:Nope", {}, [], { approach: "observation", preregistered: false, notes: "" });
  assert.equal(r.isOk, false);
  assert.equal(r.error.code, "kg_entity_failed");
});
