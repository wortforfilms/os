import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("data/support-docs.json", "utf8"));
const appSource = readFileSync("src/App.tsx", "utf8");
const electronMain = readFileSync("apps/electron/main.cjs", "utf8");
const electronPreload = readFileSync("apps/electron/preload.cjs", "utf8");
const tauriMain = readFileSync("src-tauri/src/main.rs", "utf8");

test("support docs manifest remains governed no-go", () => {
  assert.equal(manifest.productionReady, false);
  assert.equal(manifest.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(manifest.supportMode, "PREVIEW_AND_LOCAL_VALIDATION");
});

test("support docs point to real markdown files", () => {
  assert.equal(manifest.documents.length >= 7, true);
  for (const doc of manifest.documents) {
    assert.equal(existsSync(doc.path), true, `${doc.path} missing`);
    assert.equal(["READY", "PREVIEW", "BLOCKED"].includes(doc.status), true, `${doc.id} has invalid status`);
  }
});

test("Electron exposes support docs through the preload bridge", () => {
  assert.equal(electronMain.includes("maataa:support-docs"), true);
  assert.equal(electronPreload.includes("supportDocs"), true);
});

test("Tauri exposes support docs commands", () => {
  assert.equal(tauriMain.includes("support_docs"), true);
  assert.equal(tauriMain.includes("support_status"), true);
  assert.equal(tauriMain.includes("GOVERNED_PRODUCTION_NO_GO"), true);
});

test("Docs route renders the support manifest", () => {
  assert.equal(appSource.includes("Docs & Support"), true);
  assert.equal(appSource.includes("DocGroup"), true);
  assert.equal(appSource.includes("supportDocs"), true);
});
