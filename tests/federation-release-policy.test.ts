import { test } from "node:test";
import assert from "node:assert/strict";
import { enforceReleaseReadiness } from "../packages/runtime-federation/src/index.ts";

test("release readiness blocks when hardware/quorum/signer are not satisfied (fail-closed)", () => {
  const r = enforceReleaseReadiness({ hardwareAttested: false, quorum: 1, signerVerified: false });
  assert.ok(r.isOk);
  assert.equal(r.data.decision, "block");
  assert.equal(r.data.violations, 3);
});

test("release readiness allows only when all release policies pass", () => {
  const r = enforceReleaseReadiness({ hardwareAttested: true, quorum: 2, signerVerified: true });
  assert.ok(r.isOk);
  assert.equal(r.data.decision, "allow");
  assert.equal(r.data.violations, 0);
});
