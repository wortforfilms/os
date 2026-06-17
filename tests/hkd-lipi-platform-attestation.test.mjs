import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { evaluatePlatformAttestation } from "../scripts/lib/platform-attestation.mjs";

const phase25 = JSON.parse(readFileSync("release/evidence/hkd-lipi-registry-phase25-cross-platform-validation.json", "utf8"));
const live = evaluatePlatformAttestation(phase25);
const byId = Object.fromEntries(live.platforms.map((p) => [p.id, p]));

test("current Phase 25 macOS VERIFIED claim is host-attested by Darwin metadata", () => {
  const macos = phase25.platforms.find((p) => p.id === "macos");
  assert.equal(macos.status, "VERIFIED", "fixture: phase25 still claims macOS VERIFIED (evidence preserved)");
  assert.equal(macos.nodePlatform, "darwin", "fixture: committed host metadata is Darwin");
  assert.equal(byId.macos.attestation, "VERIFIED");
  assert.equal(byId.macos.hostAttested, true);
});

test("a real macOS host WOULD attest (rule is not hardcoded to fail)", () => {
  const synthetic = {
    platforms: [
      { id: "macos", label: "macOS", status: "VERIFIED", nodePlatform: "darwin", uname: "Darwin host.local 23.6.0 arm64", swVers: "ProductVersion: 14.6" },
    ],
  };
  const r = evaluatePlatformAttestation(synthetic);
  assert.equal(r.platforms[0].attestation, "VERIFIED");
  assert.equal(r.platforms[0].hostAttested, true);
  // ...but a real macOS host still does not flip production controls here.
  assert.equal(r.productionReady, false);
  assert.equal(r.runtimeEnabledRows, 0);
});

test("a macOS VERIFIED claim on Linux metadata becomes CONFLICT", () => {
  const synthetic = {
    platforms: [
      { id: "macos", label: "macOS", status: "VERIFIED", nodePlatform: "linux", uname: "Linux claude 6.8.0 aarch64 GNU/Linux", swVers: "UNKNOWN" },
    ],
  };
  const r = evaluatePlatformAttestation(synthetic);
  assert.equal(r.platforms[0].attestation, "CONFLICT");
  assert.equal(r.platforms[0].hostAttested, false);
  assert.equal(r.counts.conflict, 1);
  assert.equal(r.phkdVerdict, "CONTROLLED_PREVIEW_NO_GO");
});

test("any host/platform mismatch becomes CONFLICT or BLOCKED (fail closed)", () => {
  for (const p of live.platforms) {
    if (p.attestation === "VERIFIED") assert.equal(p.hostAttested, true, `${p.id} VERIFIED must be host-attested`);
    else assert.ok(["CONFLICT", "BLOCKED", "UNKNOWN"].includes(p.attestation), `${p.id} must be CONFLICT/BLOCKED/UNKNOWN`);
  }
  // Linux + Windows have no host metadata → BLOCKED.
  assert.equal(byId.linux.attestation, "BLOCKED");
  assert.equal(byId.windows.attestation, "BLOCKED");
});

test("a VERIFIED claim with no host metadata is UNKNOWN, never VERIFIED", () => {
  const r = evaluatePlatformAttestation({ platforms: [{ id: "linux", label: "Linux", status: "VERIFIED" }] });
  assert.equal(r.platforms[0].attestation, "UNKNOWN");
  assert.equal(r.platforms[0].hostAttested, false);
});

test("no productionReady=true and no runtimeEnabledRows>0 anywhere in the result", () => {
  assert.equal(live.productionReady, false);
  assert.equal(live.governedProductionGo, false);
  assert.equal(live.runtimeEnabledRows, 0);
  assert.equal(live.attestationPass, false, "attestation must fail closed while Linux/Windows are BLOCKED");
});

test("overall PHKD verdict remains CONTROLLED_PREVIEW_NO_GO", () => {
  assert.equal(live.phkdVerdict, "CONTROLLED_PREVIEW_NO_GO");
});

test("the committed attestation evidence matches and preserves controls", () => {
  const p = "release/evidence/hkd-lipi-platform-attestation.json";
  assert.equal(existsSync(p), true, "run scripts/verify-hkd-lipi-platform-attestation.mjs first");
  const ev = JSON.parse(readFileSync(p, "utf8"));
  assert.equal(ev.phkdVerdict, "CONTROLLED_PREVIEW_NO_GO");
  assert.equal(ev.control.productionReady, false);
  assert.equal(ev.control.governedProductionGo, false);
  assert.equal(ev.control.runtimeEnabledRows, 0);
  assert.equal(ev.control.mutationAllowed, false);
  assert.equal(ev.platforms.find((x) => x.id === "macos").attestation, "VERIFIED");
  assert.equal(ev.platforms.find((x) => x.id === "linux").attestation, "BLOCKED");
  assert.equal(ev.platforms.find((x) => x.id === "windows").attestation, "BLOCKED");
  assert.equal(ev.invariants.noPlatformVerifiedWithoutHostProof, true);
});
