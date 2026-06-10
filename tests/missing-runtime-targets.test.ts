import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const targets = [
  { dir: "avatar-runtime", name: "@maataa/avatar-runtime", runtime: "avatar-runtime" },
  { dir: "voice-runtime", name: "@maataa/voice-runtime", runtime: "voice-runtime" },
  { dir: "gesture-runtime", name: "@maataa/gesture-runtime", runtime: "gesture-runtime" },
  { dir: "chakra-runtime", name: "@maataa/chakra-runtime", runtime: "chakra-runtime" },
  { dir: "knowledge-runtime", name: "@maataa/knowledge-runtime", runtime: "knowledge-runtime" },
  { dir: "memory-runtime", name: "@maataa/memory-runtime", runtime: "memory-runtime" },
  { dir: "task-runtime", name: "@maataa/task-runtime", runtime: "task-runtime" },
  { dir: "tlp-runtime", name: "@maataa/tlp-runtime", runtime: "tlp-runtime" },
  { dir: "investor-runtime", name: "@maataa/investor-runtime", runtime: "investor-runtime" },
  { dir: "saptadhaatu-runtime", name: "@maataa/saptadhaatu-runtime", runtime: "saptadhaatu-runtime" },
  { dir: "brahmini-runtime", name: "@maataa/brahmini-runtime", runtime: "brahmini-runtime" },
  { dir: "runtime", name: "@maataa/runtime", runtime: "sovereign-runtime" },
  {
    dir: "scientific-evidence-registry-runtime",
    name: "@maataa/scientific-evidence-registry-runtime",
    runtime: "scientific-evidence-registry-runtime",
  },
];

test("all missing runtime target packages now exist on disk", () => {
  for (const target of targets) {
    const packagePath = `packages/${target.dir}/package.json`;
    assert.equal(existsSync(packagePath), true, `${target.name} package.json missing`);
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    assert.equal(pkg.name, target.name);
    assert.equal(pkg.maataa?.status, "scaffold-only");
    assert.equal(pkg.maataa?.productionReady, false);
    assert.equal(existsSync(`packages/${target.dir}/src/index.ts`), true, `${target.name} src/index.ts missing`);
  }
});

test("missing runtime targets report scaffold health and no production readiness", async () => {
  for (const target of targets) {
    const mod = await import(`../packages/${target.dir}/src/index.ts`);
    const report = mod.health();
    assert.equal(report.runtime, target.runtime);
    assert.equal(report.packageName, target.name);
    assert.equal(report.status, "scaffold");
    assert.equal(report.initialized, false);
    assert.equal(report.evidence.targetExists, true);
    assert.equal(report.evidence.implementation, "scaffold-only");
    assert.equal(report.evidence.liveDeployment, false);
    assert.equal(report.evidence.productionReady, false);
    assert.equal(report.evidence.runtimeMetrics, null);
    assert.equal(report.__meta.governedProductionGo, false);
    assert.equal(report.__meta.productionReady, false);
    assert.equal(report.__meta.liveDeployment, false);
    assert.equal(report.__meta.fakeMetrics, false);
  }
});

test("missing runtime targets fail closed for behavior", async () => {
  for (const target of targets) {
    const mod = await import(`../packages/${target.dir}/src/index.ts`);
    const invalid = mod.execute({ type: "" });
    assert.equal(invalid.isOk, false);
    assert.equal(invalid.error.code, "invalid_operation");
    const result = mod.execute({ type: "run" });
    assert.equal(result.isOk, false);
    assert.equal(result.error.code, "not_implemented");
    assert.match(result.error.detail, /scaffold-only/);
  }
});

test("missing runtime target evidence stays controlled no-go", () => {
  const evidence = JSON.parse(readFileSync("release/evidence/missing-runtime-targets.json", "utf8"));
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.finalStatus, "CONTROLLED_NO_GO");
  assert.equal(evidence.runtimeTargetsTotal, targets.length);
  assert.deepEqual(
    evidence.targets.map((target: { packageName: string }) => target.packageName).sort(),
    targets.map((target) => target.name).sort(),
  );
  assert.equal(evidence.targets.every((target: { status: string }) => target.status === "scaffold"), true);
  assert.equal(evidence.targets.every((target: { liveDeployment: boolean }) => target.liveDeployment === false), true);
});
