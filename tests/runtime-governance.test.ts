import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, definePolicy, evaluate, enforce, audit, rollback, health } from "../packages/runtime-governance/src/index.ts";

test("runtime-governance: enforce blocks on a failing block-severity policy (fail-closed)", () => {
  reset();
  assert.ok(definePolicy({ name: "hw-attested", key: "hardwareAttested", op: "truthy", severity: "block" }).isOk);
  assert.ok(definePolicy({ name: "min-quorum", key: "quorum", op: "gte", value: 2, severity: "block" }).isOk);

  const blocked = enforce({ hardwareAttested: false, quorum: 1 });
  assert.ok(blocked.isOk);
  assert.equal(blocked.data!.decision, "block");
  assert.equal(blocked.data!.violations.length, 2);

  const allowed = enforce({ hardwareAttested: true, quorum: 3 });
  assert.equal(allowed.data!.decision, "allow");
  assert.equal(allowed.data!.violations.length, 0);
});

test("runtime-governance: warn-severity does not block", () => {
  reset();
  definePolicy({ name: "nice-to-have", key: "docs", op: "truthy", severity: "warn" });
  const r = enforce({ docs: false });
  assert.equal(r.data!.decision, "allow");
  assert.equal(r.data!.violations.length, 1);
  assert.equal(r.data!.violations[0].severity, "warn");
});

test("runtime-governance: audit is hash-chained and rollbackable", () => {
  reset();
  definePolicy({ name: "p", key: "x", op: "eq", value: 1 });
  enforce({ x: 1 });
  enforce({ x: 2 });
  const a1 = audit();
  assert.equal(a1.data!.length, 2);
  assert.equal(a1.data![1].prevHash, a1.data![0].hash); // chained
  const rb = rollback(1);
  assert.equal(rb.data!.removed, 1);
  assert.equal(audit().data!.length, 1);
});

test("runtime-governance: health ready, not production-GO, doesn't claim release authority", () => {
  reset();
  const h = health();
  assert.equal(h.status, "ready");
  assert.ok(h.capabilities.includes("enforce"));
  assert.equal(h.__meta.governedProductionGo, false);
});
