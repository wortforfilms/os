import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const architecture = JSON.parse(readFileSync("data/hkd-lipi-registry-architecture.json", "utf8"));
const seed = JSON.parse(readFileSync("data/hkd-lipi-script-registry-seed-426.json", "utf8"));
const evidence = JSON.parse(readFileSync("release/evidence/hkd-lipi-registry-architecture.json", "utf8"));

const requestedSections = [
  "registryTaxonomy",
  "databaseSchema",
  "typeScriptTypes",
  "prismaModels",
  "sqliteDdl",
  "postgresqlDdl",
  "jsonSchema",
  "graphSchema",
  "searchIndexSchema",
  "kbsOntology",
  "apiContracts",
  "unicodeMappingTables",
  "scriptFamilyTrees",
  "transliterationRegistry",
  "numeralRegistry",
  "glyphRegistry",
  "fontRegistry",
  "renderingRegistry",
  "evidenceRegistry",
  "provenanceRegistry",
];

test("HKD Lipi registry architecture emits all requested output sections", () => {
  for (const section of requestedSections) {
    assert.ok(architecture[section], `missing ${section}`);
  }

  assert.equal(architecture.reviewState, "CONTROLLED_NO_GO");
  assert.equal(architecture.governedProductionGo, false);
  assert.equal(evidence.checks.noProductionClaim, true);
});

test("seed dataset is exactly 426 records with stable indexes and provenance", () => {
  assert.equal(seed.records.length, 426);
  assert.equal(architecture.seedDatasetStructure.stats.total, 426);

  const ids = new Set(seed.records.map((record) => record.id));
  const indexes = new Set(seed.records.map((record) => record.registry_index));
  assert.equal(ids.size, 426);
  assert.equal(indexes.size, 426);

  for (const record of seed.records) {
    assert.ok(record.source_refs.length > 0, `${record.id} missing source refs`);
    assert.ok(record.provenance, `${record.id} missing provenance`);
    assert.equal(record.hkd_runtime_enabled, false, `${record.id} must fail closed`);
  }
});

test("all Unicode Script property values come from UCD aliases and ranges stay sourced", () => {
  const aliasLines = readFileSync("data/unicode/ucd-latest/PropertyValueAliases.txt", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^sc\s*;/.test(line));
  const unicodeRows = seed.records.filter((record) => record.registry_class === "unicode");

  assert.equal(architecture.unicodeMappingTables.scriptPropertyValues.length, aliasLines.length);
  assert.equal(unicodeRows.length, aliasLines.length);
  assert.equal(aliasLines.length, 176);

  for (const row of unicodeRows) {
    assert.equal(row.iso15924, row.unicode_script_alias);
    assert.ok(row.source_refs.includes("unicode-ucd-17-property-value-aliases"));
    assert.ok(row.source_refs.includes("unicode-ucd-17-scripts"));
    assert.ok(row.source_refs.includes("unicode-ucd-17-blocks"));
    assert.notEqual(row.unicode_script_value, "UNKNOWN");
  }
});

test("non-Unicode research and reserved rows do not invent Unicode or ISO assignments", () => {
  const nonUnicodeRows = seed.records.filter((record) => record.registry_class !== "unicode");
  assert.ok(nonUnicodeRows.length > 0);

  for (const row of nonUnicodeRows) {
    assert.equal(row.unicode_script_value, "UNKNOWN", `${row.id} invented script value`);
    assert.equal(row.unicode_script_alias, "UNKNOWN", `${row.id} invented script alias`);
    assert.equal(row.iso15924, "UNKNOWN", `${row.id} invented ISO 15924`);

    if (row.id.startsWith("hkd-evidence-slot-")) {
      assert.equal(row.unicode_status, "unencoded");
      assert.equal(row.evidence_status, "unknown");
      assert.equal(row.provenance.stance, "reserved_slot_no_claim");
    }
  }
});

test("schema, DDL, Prisma, TypeScript, markdown, and HTML artifacts exist", () => {
  const paths = Object.values(evidence.artifacts);
  for (const path of paths) {
    assert.equal(existsSync(path), true, `${path} does not exist`);
  }

  const sqlite = readFileSync("migrations/sqlite/010_hkd_lipi_registry.sql", "utf8");
  const postgres = readFileSync("migrations/postgresql/010_hkd_lipi_registry.sql", "utf8");
  const prisma = readFileSync("packages/lipi-runtime/prisma/hkd-lipi-registry.prisma", "utf8");
  const types = readFileSync("packages/lipi-runtime/src/registry/hkd-lipi-registry-types.ts", "utf8");
  const html = readFileSync("release/HKD_LIPI_REGISTRY_ARCHITECTURE.html", "utf8");

  assert.match(sqlite, /CREATE TABLE IF NOT EXISTS hkd_lipi_script_registry/);
  assert.match(postgres, /JSONB/);
  assert.match(prisma, /model HkdLipiScriptRegistry/);
  assert.match(types, /interface HkdLipiScriptRegistryRecord/);
  assert.match(html, /CONTROLLED_NO_GO/);
  assert.doesNotMatch(html, /productionReady:true|governedProductionGo:true/i);
});
