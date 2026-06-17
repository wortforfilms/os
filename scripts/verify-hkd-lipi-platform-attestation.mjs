#!/usr/bin/env node
/*
 * Host/platform attestation probe for the HKD Lipi Registry (fail closed).
 *
 * Reads the committed Phase 25 cross-platform evidence and classifies each
 * platform target. A platform may be host-attested VERIFIED only if its OWN
 * captured host metadata proves the platform. Mismatched host metadata becomes
 * CONFLICT; missing platform execution remains BLOCKED/UNKNOWN.
 *
 * Writes release/evidence/hkd-lipi-platform-attestation.json.
 * Exits non-zero if any platform is improperly VERIFIED (CONFLICT) so CI fails
 * closed. Never rewrites registry rows, never sets productionReady=true, never
 * enables runtime rows.
 *
 * Run: node scripts/verify-hkd-lipi-platform-attestation.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { evaluatePlatformAttestation } from "./lib/platform-attestation.mjs";

const root = process.cwd();
const J = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), "utf8")) : null);

const PHASE25 = "release/evidence/hkd-lipi-registry-phase25-cross-platform-validation.json";
const ACTIVATION = "release/evidence/hkd-lipi-registry-runtime-activation.json";

const phase25 = J(PHASE25);
if (!phase25) throw new Error(`missing ${PHASE25} — cannot attest platforms without the phase 25 evidence`);
const activation = J(ACTIVATION) || {};

const result = evaluatePlatformAttestation(phase25);

// Carry the runtime control flags straight from the committed activation evidence
// (read-only — this probe never changes them).
const control = {
  registryRuntimeActive: activation.registryRuntimeActive === true,
  runtimeMode: activation.runtimeMode ?? "CONTROLLED_PREVIEW",
  readOnly: activation.readOnly !== false,
  mutationAllowed: activation.mutationAllowed === true ? true : false,
  runtimeEnabledRows: Number(activation.runtimeEnabledRows ?? 0),
  productionReady: false,
  governedProductionGo: false,
  releaseCandidate: activation.releaseCandidate === true ? true : false,
};

const evidence = {
  schema: "maataa.hkd-lipi.platform-attestation.v1",
  generatedAt: new Date().toISOString(),
  source: PHASE25,
  sourcePolicy: "host_metadata_must_prove_platform_or_fail_closed_no_registry_mutation_no_runtime_enablement",
  honesty:
    "Phase 25 evidence is preserved unchanged. A platform is host-attested VERIFIED only when its own captured host metadata proves it. " +
    "Mismatched host metadata is reclassified CONFLICT; missing platform evidence remains BLOCKED or UNKNOWN.",
  reviewState: "CONTROLLED_PREVIEW_NO_GO",
  phkdVerdict: "CONTROLLED_PREVIEW_NO_GO",
  attestationPass: result.attestationPass,
  control,
  counts: result.counts,
  platforms: result.platforms,
  blockers: result.blockers,
  // sanity invariants asserted at generation time (fail closed if violated)
  invariants: {
    productionReadyFalse: control.productionReady === false,
    governedProductionGoFalse: control.governedProductionGo === false,
    runtimeEnabledRowsZero: control.runtimeEnabledRows === 0,
    mutationNotAllowed: control.mutationAllowed === false,
    noPlatformVerifiedWithoutHostProof: result.platforms.every((p) => p.attestation !== "VERIFIED" || p.hostAttested === true),
  },
};

if (Object.values(evidence.invariants).some((v) => v !== true)) {
  throw new Error(`PHKD invariant violation: ${JSON.stringify(evidence.invariants)}`);
}

const OUT = "release/evidence/hkd-lipi-platform-attestation.json";
const body = `${JSON.stringify(evidence, null, 2)}\n`;
writeFileSync(join(root, OUT), body);
const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);

console.log(`platform-attestation: ${result.counts.verified} verified / ${result.counts.conflict} CONFLICT / ${result.counts.blocked} blocked / ${result.counts.unknown} unknown (sha ${hash})`);
for (const p of result.platforms) console.log(`  [${p.attestation}] ${p.id}: ${p.reason}`);
console.log(`verdict: ${evidence.phkdVerdict} | productionReady=${control.productionReady} | runtimeEnabledRows=${control.runtimeEnabledRows} | attestationPass=${result.attestationPass}`);

// Fail closed: a CONFLICT (improperly-VERIFIED claim) must make this probe exit non-zero.
if (result.counts.conflict > 0) {
  console.error(`FAIL CLOSED: ${result.counts.conflict} platform claim(s) are VERIFIED without host attestation.`);
  process.exitCode = 1;
}
