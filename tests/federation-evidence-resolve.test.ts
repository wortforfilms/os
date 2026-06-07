import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveValidationEvidence } from "../packages/runtime-federation/src/index.ts";
import * as registry from "../packages/runtime-hkd-registry/src/index.ts";
import * as validation from "../packages/runtime-validation/src/index.ts";

test("validation → registry: evidence refs resolve against the ledger", async () => {
  registry.reset();
  validation.reset();
  const art = await registry.register({ name: "ev", kind: "evidence", version: "1", payloadHash: "h", registrant: "op" });
  assert.ok(art.isOk);

  const claim = await validation.submitClaim(
    { runtime: "runtime-knowledge-graph", entityId: "ent-1" },
    [{ ref: { runtime: "runtime-hkd-registry", id: art.data.id }, weight: 2 }],
    { approach: "observation", preregistered: false, notes: "" },
  );
  const res = await resolveValidationEvidence(claim.data.validationId);
  assert.ok(res.isOk, JSON.stringify(res.error));
  assert.equal(res.data.total, 1);
  assert.equal(res.data.resolved, 1);
  assert.equal(res.data.unresolved.length, 0);
});

test("validation → registry: unknown evidence id is reported unresolved", async () => {
  registry.reset();
  validation.reset();
  const claim = await validation.submitClaim(
    { runtime: "runtime-knowledge-graph", entityId: "ent-2" },
    [{ ref: { runtime: "runtime-hkd-registry", id: "art-missing" }, weight: 1 }],
    { approach: "observation", preregistered: false, notes: "" },
  );
  const res = await resolveValidationEvidence(claim.data.validationId);
  assert.equal(res.data.resolved, 0);
  assert.equal(res.data.unresolved.length, 1);
});
