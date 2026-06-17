import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const paths = {
  json: "release/exports/hkd-lipi-registry-export.json",
  csv: "release/exports/hkd-lipi-registry-export.csv",
  sql: "release/exports/hkd-lipi-registry-export.sql",
  audit: "release/evidence/hkd-lipi-registry-audit-report.json",
  provenance: "release/evidence/hkd-lipi-registry-provenance-report.json",
};

const exportJson = readJson(paths.json);
const audit = readJson(paths.audit);
const provenance = readJson(paths.provenance);
const csvText = readFileSync(paths.csv, "utf8");
const sqlText = readFileSync(paths.sql, "utf8");

test("requested export and audit artifacts exist", () => {
  for (const path of Object.values(paths)) {
    assert.equal(existsSync(path), true, path);
  }
  assert.equal(exportJson.counts.registryRows, 426);
  assert.equal(exportJson.counts.kbsNodes, 3372);
  assert.equal(exportJson.counts.kbsEdges, 5233);
});

test("every node is reachable from provenance and no evidence reference is orphaned", () => {
  assert.equal(audit.checks.everyNodeReachableFromProvenance, true);
  assert.equal(audit.checks.noOrphanEvidenceReferences, true);
  assert.equal(provenance.counts.nodesUnreachableFromProvenance, 0);
  assert.equal(provenance.counts.orphanEvidenceReferences, 0);
  assert.deepEqual(provenance.nodesUnreachableFromProvenance, []);
  assert.deepEqual(provenance.orphanEvidenceReferences, []);
});

test("runtime and production readiness remain disabled across exports", () => {
  assert.equal(audit.runtimeEnabled, 0);
  assert.equal(audit.productionReady, false);
  assert.equal(audit.governedProductionGo, false);
  assert.equal(audit.phkdVerdict, "CONTROLLED_NO_GO");
  assert.equal(audit.checks.noRuntimeEnabledTrue, true);
  assert.equal(audit.checks.noProductionReadyTrue, true);
  assert.equal(exportJson.scripts.every((row) => row.runtime_enabled === false), true);
  assert.equal(exportJson.scripts.every((row) => row.productionReady === false), true);
  assert.equal(sqlText.includes("runtime_enabled INTEGER NOT NULL"), true);
  assert.equal(sqlText.includes("production_ready INTEGER NOT NULL"), true);
});

test("CSV and SQL exports cover the 426 registry rows and graph tables", () => {
  const csvRows = csvText.trimEnd().split(/\r?\n/);
  assert.equal(csvRows.length, 427);
  assert.match(csvRows[0], /^id,registry_index,display_name,/);
  assert.equal(countMatches(sqlText, "INSERT INTO hkd_lipi_registry_export VALUES"), 426);
  assert.equal(countMatches(sqlText, "INSERT INTO hkd_lipi_kbs_node_export VALUES"), 3372);
  assert.equal(countMatches(sqlText, "INSERT INTO hkd_lipi_kbs_edge_export VALUES"), 5233);
});

test("audit report hashes match current export artifacts", () => {
  const hashByPath = new Map(audit.outputHashes.map((entry) => [entry.path, entry.sha256]));
  for (const path of [paths.json, paths.csv, paths.sql, paths.provenance]) {
    assert.equal(hashByPath.get(path), sha256(path), path);
  }
});

test("export reproducibility check passes without rewriting outputs", () => {
  const result = execFileSync("node", ["scripts/generate-hkd-lipi-registry-audit-exports.mjs", "--check"], { encoding: "utf8" });
  const parsed = JSON.parse(result);
  assert.equal(parsed.reproducible, true);
  assert.deepEqual(parsed.mismatches, []);
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function countMatches(value, pattern) {
  return value.split(pattern).length - 1;
}
