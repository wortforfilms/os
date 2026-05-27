import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const release = JSON.parse(readFileSync("release/evidence/maataa-ui-release.json", "utf8"));
const manifest = JSON.parse(readFileSync("release/evidence/maataa-ui-package-manifest.json", "utf8"));
const modulesSource = readFileSync("packages/maataa-ui/src/data/runtime-modules.ts", "utf8");
const languageSource = readFileSync("packages/maataa-ui/src/data/language-interface-matrix.ts", "utf8");

test("all public exports have source files or declarations", () => {
  for (const exportName of manifest.requiredExports) {
    const found = findInPackageSource(exportName);
    assert.equal(found, true, `${exportName} is not exported by source`);
  }
});

test("Aam Jantaa modules exist", () => {
  for (const moduleId of ["digital-gurukul", "radio-vaigyaaniq", "local-search", "runtime-health", "lipi-learning", "community-broadcast"]) {
    assert.equal(modulesSource.includes(`id: "${moduleId}"`), true, `${moduleId} missing`);
  }
});

test("language modes hi/hr/pa exist", () => {
  for (const code of ["hi", "hr", "pa"]) {
    assert.equal(languageSource.includes(`code: "${code}"`), true, `${code} missing`);
  }
});

test("every feature has honest badge", () => {
  const allowed = ["READY", "PREVIEW", "BLOCKED", "OFFLINE", "VERIFYING", "DEGRADED"];
  const matches = [...modulesSource.matchAll(/statusBadge:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(matches.length >= 6, true);
  for (const badge of matches) {
    assert.equal(allowed.includes(badge), true, `invalid badge ${badge}`);
  }
});

test("blocked features have blocked reason", () => {
  const blockedSections = modulesSource.split("statusBadge: \"BLOCKED\"");
  assert.equal(blockedSections.length > 1, true);
  for (const section of blockedSections.slice(1)) {
    assert.match(section.slice(0, 500), /blockedReason:\s*"[^"]+"/);
  }
});

test("productionReady remains false", () => {
  assert.equal(release.productionReady, false);
});

test("finalStatus remains GOVERNED_PRODUCTION_NO_GO", () => {
  assert.equal(release.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
});

function findInPackageSource(name) {
  const candidateFiles = [
    `packages/maataa-ui/src/components/${name}.tsx`,
    "packages/maataa-ui/src/types/governance.ts",
    "packages/maataa-ui/src/types/runtime.ts",
    "packages/maataa-ui/src/types/aam-jantaa.ts",
    "packages/maataa-ui/src/data/language-interface-matrix.ts",
    "packages/maataa-ui/src/data/launch-readiness.ts",
  ];
  return candidateFiles.some((file) => existsSync(join(root, file)) && readFileSync(join(root, file), "utf8").includes(name));
}
