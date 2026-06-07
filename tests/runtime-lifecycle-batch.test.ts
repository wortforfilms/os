import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as registry from "../packages/runtime-hkd-registry/src/index.ts";
import * as validation from "../packages/runtime-validation/src/index.ts";

const claimRef = { runtime: "runtime-knowledge-graph", entityId: "ent-1" } as const;
const method = { approach: "observation", preregistered: false, notes: "" } as const;

test("registry.revoke removes an artifact from resolve but keeps it in the ledger", async () => {
  registry.reset();
  const a = await registry.register({ name: "x", kind: "evidence", version: "1", payloadHash: "h", registrant: "op" });
  assert.ok((await registry.resolve("x")).isOk);
  const rv = await registry.revoke(a.data.id);
  assert.ok(rv.isOk);
  assert.equal((await registry.resolve("x")).isOk, false); // revoked → not resolvable
  assert.equal((await registry.list()).data.length, 1);     // retained for audit
  assert.equal((await registry.revoke("art-missing")).isOk, false);
});

test("validation.recordReplication raises replication count", async () => {
  validation.reset();
  const s = await validation.submitClaim(claimRef, [], method);
  const r1 = await validation.recordReplication(s.data.validationId);
  assert.equal(r1.data.replicationCount, 1);
  await validation.recordReplication(s.data.validationId);
  const rep = await validation.replicationStatus(s.data.validationId);
  assert.equal(rep.data.replications, 2);
});

test("validation.moderate is fail-closed: needs review, no double-finalise", async () => {
  validation.reset();
  const s = await validation.submitClaim(claimRef, [{ ref: { runtime: "runtime-hkd-registry", id: "e" }, weight: 5 }], method);
  // pending → cannot moderate yet
  assert.equal((await validation.moderate(s.data.validationId, "accepted")).isOk, false);
  await validation.assess(s.data.validationId); // → reviewed
  const m = await validation.moderate(s.data.validationId, "accepted");
  assert.ok(m.isOk);
  assert.equal(m.data.moderationState, "accepted");
  // already finalised → cannot re-moderate
  assert.equal((await validation.moderate(s.data.validationId, "rejected")).isOk, false);
});

test("maataa health CLI reports all runtimes ready and exits 0", () => {
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "scripts/maataa-health.mjs"], { cwd: process.cwd(), encoding: "utf8" });
  assert.match(out, /MAATAA federation health/);
  assert.match(out, /allReady=true/);
});
