import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("data/sovereign-runtime-ascii-tauri.json", "utf8"));
const evidence = JSON.parse(readFileSync("release/evidence/sovereign-runtime-ascii-tauri.json", "utf8"));
const html = readFileSync("release/SOVEREIGN_RUNTIME_ASCII_TAURI.html", "utf8");
const rust = readFileSync("src-tauri/src/main.rs", "utf8");

test("ASCII Tauri runtime remains governed no-go", () => {
  assert.equal(data.productionReady, false);
  assert.equal(data.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.phkdVerdict, "BLOCKED");
});

test("ASCII frame preserves fixed local terminal contract", () => {
  assert.equal(data.frame.encoding, "ASCII");
  assert.equal(data.frame.columns, 80);
  assert.ok(data.frame.lines.length >= 20);
  assert.equal(html.includes("MAATAA OS :: SOVEREIGN RUNTIME ASCII :: TAURI SHELL"), true);
});

test("Tauri exposes sovereign ASCII commands", () => {
  assert.equal(rust.includes("sovereign_ascii_status"), true);
  assert.equal(rust.includes("sovereign_ascii_frame"), true);
});

test("blockers remain explicit", () => {
  for (const blocker of ["hardware_attestation_missing", "operator_quorum_unverified", "signed_release_authority_unverified", "rollback_drill_not_verified"]) {
    assert.equal(data.activeBlockers.includes(blocker), true, `${blocker} missing`);
    assert.equal(evidence.activeBlockers.includes(blocker), true, `${blocker} missing in evidence`);
  }
});
