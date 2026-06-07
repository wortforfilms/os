import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, register, resolve, list, pin, verify, health } from "../packages/runtime-hkd-registry/src/index.ts";

test("runtime-hkd-registry: register/resolve/list/pin/verify on a hash-chained ledger", async () => {
  reset();
  const r1 = await register({ name: "kbs", kind: "runtime", version: "1.0.0", payloadHash: "h1", registrant: "op" });
  const r2 = await register({ name: "kbs", kind: "runtime", version: "1.1.0", payloadHash: "h2", registrant: "op" });
  assert.ok(r1.isOk && r2.isOk);

  const res = await resolve("kbs");
  assert.ok(res.isOk);
  assert.equal(res.data!.version, "1.1.0"); // latest

  const runtimes = await list({ kind: "runtime" });
  assert.equal(runtimes.data!.length, 2);

  const p = await pin(r2.data!.id, "1.1.0");
  assert.ok(p.isOk);

  const v = await verify(r2.data!.id);
  assert.ok(v.isOk);
  assert.equal(v.data!.signatureValid, true);
  assert.equal(v.data!.trustChain, "advisory"); // content-digest, never "enforced"
});

test("runtime-hkd-registry: fail-closed on missing artifact", async () => {
  reset();
  const v = await verify("art-nope");
  assert.equal(v.isOk, false);
});

test("runtime-hkd-registry: health ready, advisory trust, not production-GO", async () => {
  reset();
  const h = health();
  assert.equal(h.status, "ready");
  assert.equal(h.evidence.trustState, "advisory");
  assert.equal(h.__meta.governedProductionGo, false);
});
