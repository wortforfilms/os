import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("release/MATA_OS_SUPPORT_CENTER.html", "utf8");
const evidence = JSON.parse(readFileSync("release/evidence/mata-os-support-center.json", "utf8"));

test("support center artifact contains governed status", () => {
  assert.equal(html.includes("MATA OS Support Center"), true);
  assert.equal(html.includes("GOVERNED_PRODUCTION_NO_GO"), true);
  assert.equal(html.includes("PRODUCTION_READY = FALSE"), true);
});

test("support center artifact links all support documents", () => {
  for (const path of [
    "docs/user-guide.md",
    "docs/support.md",
    "docs/troubleshooting.md",
    "docs/faq.md",
    "docs/support/support-request-template.md",
    "docs/support/operator-escalation.md",
    "docs/support/release-support-checklist.md"
  ]) {
    assert.equal(html.includes(path), true, `${path} missing`);
  }
});

test("support center release evidence remains no-go", () => {
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(evidence.documentsEmbedded, 7);
});
