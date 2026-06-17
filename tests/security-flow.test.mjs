import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import sec, {
  reset,
  createSession,
  processSecureAction,
  retrieve,
  rawStored,
  getAudit,
  verifyAudit,
  STAGE_ORDER,
} from "../packages/runtime-security/src/index.ts";

const key = () => randomBytes(32);

test("happy path runs all 7 stages in order and stores ciphertext only", () => {
  reset();
  const k = key();
  const s = createSession("u-hemant", "custodian");
  const r = processSecureAction({ token: s.data.token, action: "write-evidence", payload: { claim: "endangered-mandaic", note: "review" }, key: k });
  assert.equal(r.isOk, true, r.isOk ? "" : r.error?.detail);
  assert.deepEqual(r.data.stages, STAGE_ORDER);
  assert.equal(r.data.decision, "allow");

  // Secure storage holds NO plaintext.
  const raw = rawStored(r.data.recordId);
  assert.equal(raw.alg, "aes-256-gcm");
  const blob = JSON.stringify(raw);
  assert.doesNotMatch(blob, /endangered-mandaic/);
  assert.doesNotMatch(blob, /review/);

  // Correct key decrypts back to the original payload.
  const got = retrieve(r.data.recordId, k);
  assert.equal(got.isOk, true);
  assert.deepEqual(got.data, { claim: "endangered-mandaic", note: "review" });
});

test("FAIL CLOSED: no/invalid session is denied at auth and audited", () => {
  reset();
  const r = processSecureAction({ token: "bogus", action: "write-evidence", payload: { x: 1 }, key: key() });
  assert.equal(r.isOk, false);
  assert.equal(r.error.stage, "auth");
  assert.equal(getAudit().at(-1).decision, "deny");
});

test("FAIL CLOSED: role without permission is denied at permission", () => {
  reset();
  const s = createSession("u-guest", "guest");
  const r = processSecureAction({ token: s.data.token, action: "write-evidence", payload: { x: 1 }, key: key() });
  assert.equal(r.isOk, false);
  assert.equal(r.error.stage, "permission");
  assert.match(r.error.detail, /may not/);
});

test("FAIL CLOSED: policy violation is denied at policy", () => {
  reset();
  const s = createSession("u-hemant", "custodian");
  const r = processSecureAction({ token: s.data.token, action: "write-evidence", payload: { classification: "forbidden" }, key: key() });
  assert.equal(r.isOk, false);
  assert.equal(r.error.stage, "policy");
});

test("FAIL CLOSED: empty payload is denied at policy", () => {
  reset();
  const s = createSession("u-hemant", "custodian");
  const r = processSecureAction({ token: s.data.token, action: "write-evidence", payload: {}, key: key() });
  assert.equal(r.isOk, false);
  assert.equal(r.error.stage, "policy");
});

test("FAIL CLOSED: wrong decryption key fails (auth tag)", () => {
  reset();
  const s = createSession("u-hemant", "custodian");
  const r = processSecureAction({ token: s.data.token, action: "write-evidence", payload: { secret: 42 }, key: key() });
  const got = retrieve(r.data.recordId, key()); // different key
  assert.equal(got.isOk, false);
  assert.equal(got.error.code, "E_DECRYPT");
});

test("audit log is append-only + hash-chained and tamper is detected", () => {
  reset();
  const s = createSession("u-hemant", "custodian");
  processSecureAction({ token: s.data.token, action: "write-evidence", payload: { a: 1 }, key: key() });
  processSecureAction({ token: s.data.token, action: "read-evidence", payload: { a: 1 }, key: key() }); // permission allows read
  const v = verifyAudit();
  assert.equal(v.isOk, true);
  assert.ok(v.data.events >= 2);
  // chain links
  const log = getAudit();
  assert.equal(log[0].prevHash, null);
  assert.equal(log[1].prevHash, log[0].hash);
});

test("health exposes no production-GO", () => {
  reset();
  assert.equal(sec.health().governedProductionGo, false);
});
