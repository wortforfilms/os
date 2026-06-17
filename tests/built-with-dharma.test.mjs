import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { evaluateDharma } from "../scripts/lib/dharma-facets.mjs";

const root = process.cwd();
const { facets, overallPass } = evaluateDharma({ root, join, existsSync, readFileSync, readdirSync });
const byName = Object.fromEntries(facets.map((f) => [f.name, f]));

test("all six dharma facets are present", () => {
  assert.deepEqual(
    facets.map((f) => f.name).sort(),
    [
      "ethical-ai-claim-guard",
      "offline-ready",
      "open-source",
      "privacy-no-default-telemetry",
      "sovereign-data-local",
      "transparent-reproducible-evidence",
    ],
  );
});

test("open-source is backed by a real LICENSE granting the four freedoms", () => {
  assert.equal(existsSync(join(root, "LICENSE")), true);
  const lic = readFileSync(join(root, "LICENSE"), "utf8");
  for (const k of ["USE", "STUDY", "MODIFY", "REDISTRIBUTE"]) assert.match(lic, new RegExp(`\\b${k}\\b`, "i"));
  assert.match(lic, /SPDX-License-Identifier:/);
  assert.equal(byName["open-source"].pass, true, byName["open-source"].proof);
});

test("privacy facet fails closed if any telemetry SDK appears", () => {
  // Current repo: no telemetry SDKs => pass. The check is real (scans deps).
  assert.equal(byName["privacy-no-default-telemetry"].pass, true, byName["privacy-no-default-telemetry"].proof);
});

test("offline, ethical-ai guard, sovereign-data and transparency are evidenced", () => {
  assert.equal(byName["offline-ready"].pass, true, byName["offline-ready"].proof);
  assert.equal(byName["ethical-ai-claim-guard"].pass, true, byName["ethical-ai-claim-guard"].proof);
  assert.equal(byName["sovereign-data-local"].pass, true, byName["sovereign-data-local"].proof);
  assert.equal(byName["transparent-reproducible-evidence"].pass, true, byName["transparent-reproducible-evidence"].proof);
});

test("claim is ACHIEVED only when ALL six facets pass", () => {
  assert.equal(overallPass, facets.every((f) => f.pass));
  assert.equal(overallPass, true);
});
