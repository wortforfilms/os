#!/usr/bin/env node
/*
 * Runs the runtime-security pipeline once against fixtures and writes
 * release/evidence/security-flow.json — a real, reproducible trace of:
 *   User Action → Auth → Permission → Policy → Encrypted Processing
 *               → Secure Storage → Audit Log
 * plus the fail-closed denials. No fake data; everything is computed at run time.
 *
 * Run: node scripts/generate-security-flow-evidence.mjs
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
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

const root = process.cwd();
reset();
const key = randomBytes(32);
const session = createSession("u-hemant", "custodian");

// Happy path (allow).
const allow = processSecureAction({
  token: session.data.token,
  action: "write-evidence",
  payload: { claim: "endangered-mandaic", note: "review-pending" },
  key,
});
if (!allow.isOk) throw new Error(`pipeline did not allow the fixture action: ${allow.error.detail}`);

const raw = rawStored(allow.data.recordId);
const rawBlob = JSON.stringify(raw);
const plaintextLeak = /endangered-mandaic|review-pending/.test(rawBlob);
if (plaintextLeak) throw new Error("FAIL CLOSED: plaintext leaked into secure storage");
const roundtrip = retrieve(allow.data.recordId, key);
if (!roundtrip.isOk) throw new Error("could not decrypt own record with the correct key");

// Fail-closed denials (each must be denied at the right stage).
const denials = [];
const expectDeny = (label, stage, input) => {
  const r = processSecureAction(input);
  denials.push({ label, expectedStage: stage, denied: !r.isOk, atStage: r.isOk ? null : r.error.stage, code: r.isOk ? null : r.error.code });
  if (r.isOk || r.error.stage !== stage) throw new Error(`${label}: expected deny at ${stage}, got ${r.isOk ? "ALLOW" : r.error.stage}`);
};
expectDeny("invalid-session", "auth", { token: "bogus", action: "write-evidence", payload: { x: 1 }, key });
expectDeny("no-permission", "permission", { token: createSession("g", "guest").data.token, action: "write-evidence", payload: { x: 1 }, key });
expectDeny("policy-forbidden", "policy", { token: session.data.token, action: "write-evidence", payload: { classification: "forbidden" }, key });
const wrongKey = retrieve(allow.data.recordId, randomBytes(32));

const auditChain = verifyAudit();
if (!auditChain.isOk) throw new Error("audit chain failed to verify");

const evidence = {
  schema: "maataa.security-flow.v1",
  generatedAt: new Date().toISOString(),
  runtime: "@maataa/runtime-security",
  reviewState: "CONTROLLED_NO_GO",
  governedProductionGo: false,
  honesty:
    "Real end-to-end secure-action pipeline (in-memory tier). AES-256-GCM encryption, ciphertext-only storage, " +
    "append-only hash-chained audit. Fail-closed at every stage. Not a production security certification.",
  stageOrder: STAGE_ORDER,
  happyPath: {
    decision: allow.data.decision,
    stages: allow.data.stages,
    recordId: allow.data.recordId,
    storedAlgorithm: raw.alg,
    plaintextInStorage: plaintextLeak,
    decryptRoundtripOk: roundtrip.isOk,
    auditSeq: allow.data.auditSeq,
    auditHash: allow.data.auditHash,
  },
  failClosed: {
    denials,
    wrongKeyDecryptDenied: !wrongKey.isOk,
    wrongKeyCode: wrongKey.isOk ? null : wrongKey.error.code,
  },
  audit: { events: auditChain.data.events, chainOk: auditChain.data.chainOk, log: getAudit().map((e) => ({ seq: e.seq, actor: e.actor, action: e.action, decision: e.decision, stage: e.stage, hash: e.hash.slice(0, 16) })) },
  health: sec.health(),
};

writeFileSync(join(root, "release/evidence/security-flow.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`security-flow: allow stages=${allow.data.stages.length}/7 | denials=${denials.length} fail-closed | audit ${auditChain.data.events} events chainOk=${auditChain.data.chainOk} | plaintextInStorage=${plaintextLeak}`);
