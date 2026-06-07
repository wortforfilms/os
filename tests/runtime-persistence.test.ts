import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import RuntimePersistence from "../packages/runtime-persistence/src/index.ts";

test("runtime-persistence: SQLite state survives close and reopen", () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "maataa-runtime-persistence-")), "state.sqlite");
  const p1 = new RuntimePersistence("runtime-test", dbPath);
  const saved = p1.persist("state", { value: 42, nested: ["a", "b"] });
  assert.equal(saved.ok, true);
  assert.equal(p1.recordCount(), 1);
  p1.close();

  const p2 = new RuntimePersistence("runtime-test", dbPath);
  const loaded = p2.load("state");
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.value, { value: 42, nested: ["a", "b"] });
  assert.equal(p2.health().backend, "node:sqlite");
  p2.close();
});

test("six runtimes persist and restore state through runtime-persistence", async () => {
  const suffix = Date.now();

  const mission = await import(`../packages/runtime-mission/src/index.ts?persist=${suffix}-mission-a`);
  mission.reset();
  const declared = await mission.declareMission({ name: "persisted-mission", declaredState: { ok: true }, observableQueries: [], acceptanceThresholds: {} });
  assert.ok(declared.isOk);
  const missionReloaded = await import(`../packages/runtime-mission/src/index.ts?persist=${suffix}-mission-b`);
  assert.equal(missionReloaded.health().evidence.missionCount, 1);
  missionReloaded.reset();

  const governance = await import(`../packages/runtime-governance/src/index.ts?persist=${suffix}-governance-a`);
  governance.reset();
  governance.definePolicy({ name: "policy", key: "ok", op: "truthy" });
  governance.enforce({ ok: true });
  const governanceReloaded = await import(`../packages/runtime-governance/src/index.ts?persist=${suffix}-governance-b`);
  assert.equal(governanceReloaded.health().evidence.policyCount, 1);
  assert.equal(governanceReloaded.health().evidence.enforcementCount, 1);
  governanceReloaded.reset();

  const observability = await import(`../packages/runtime-observability/src/index.ts?persist=${suffix}-observability-a`);
  observability.reset();
  observability.report("runtime-x", "ready");
  observability.link("runtime-x", "runtime-y", "reads");
  observability.emit("evt-1", "runtime-x", "health");
  const observabilityReloaded = await import(`../packages/runtime-observability/src/index.ts?persist=${suffix}-observability-b`);
  assert.equal(observabilityReloaded.health().evidence.reportedRuntimes, 1);
  assert.equal(observabilityReloaded.health().evidence.topologyEdges, 1);
  assert.equal(observabilityReloaded.health().evidence.lineageEvents, 1);
  observabilityReloaded.reset();

  const kg = await import(`../packages/runtime-knowledge-graph/src/index.ts?persist=${suffix}-kg-a`);
  kg.reset();
  const type = await kg.defineEntityType({ name: "Persisted", schema: { name: "string" } });
  await kg.addEntity(type.data.typeId, { name: "one" });
  const kgReloaded = await import(`../packages/runtime-knowledge-graph/src/index.ts?persist=${suffix}-kg-b`);
  assert.equal(kgReloaded.health().evidence.entityTypes, 1);
  assert.equal(kgReloaded.health().evidence.entities, 1);
  kgReloaded.reset();

  const registry = await import(`../packages/runtime-hkd-registry/src/index.ts?persist=${suffix}-registry-a`);
  registry.reset();
  const artifact = await registry.register({ name: "artifact", kind: "runtime", version: "1.0.0", payloadHash: "abc", registrant: "test" });
  await registry.pin(artifact.data.id, "1.0.0");
  const registryReloaded = await import(`../packages/runtime-hkd-registry/src/index.ts?persist=${suffix}-registry-b`);
  assert.equal(registryReloaded.health().evidence.artifactCount, 1);
  assert.equal(registryReloaded.health().evidence.pinCount, 1);
  registryReloaded.reset();

  const validation = await import(`../packages/runtime-validation/src/index.ts?persist=${suffix}-validation-a`);
  validation.reset();
  await validation.submitClaim(
    { runtime: "runtime-knowledge-graph", entityId: "ent-1" },
    [{ ref: { runtime: "runtime-hkd-registry", id: "art-1" }, weight: 1 }],
    { approach: "observation", preregistered: false, notes: "persistence test" },
  );
  const validationReloaded = await import(`../packages/runtime-validation/src/index.ts?persist=${suffix}-validation-b`);
  assert.equal(validationReloaded.health().evidence.claimCount, 1);
  validationReloaded.reset();
});
