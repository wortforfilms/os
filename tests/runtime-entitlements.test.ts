// Real tests for @maataa/runtime-entitlements.
// Enforcement is fail-closed; billing is a deterministic simulation. No mocks.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EntitlementRuntime,
  simulateBill,
  skuById,
  SKUS,
} from "../packages/runtime-entitlements/src/index.ts";

const GB = 1024 * 1024 * 1024;

test("entitlement boundary: allows within cap, DENIES over cap (fail closed)", () => {
  const e = new EntitlementRuntime();
  e.setSku("acct-1", "starter"); // seats cap = 3
  assert.equal(e.consume("acct-1", "seats", 3).allowed, true);
  const denied = e.consume("acct-1", "seats", 1); // 4th seat
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /exceed seats cap/);
  assert.equal(e.getUsage("acct-1").seats, 3); // denied consume did NOT mutate
});

test("unknown account / unknown SKU are denied, never default-allow", () => {
  const e = new EntitlementRuntime();
  const d = e.consume("ghost", "devices", 1);
  assert.equal(d.allowed, false);
  assert.match(d.reason, /no entitlement/);
  assert.throws(() => e.setSku("x", "does-not-exist"), /unknown SKU/);
});

test("check() is non-mutating; release() frees capacity", () => {
  const e = new EntitlementRuntime();
  e.setSku("a", "team");
  assert.equal(e.check("a", "seats", 10).allowed, true);
  assert.equal(e.getUsage("a").seats, 0); // check didn't consume
  e.consume("a", "seats", 25); // fill to cap
  assert.equal(e.consume("a", "seats", 1).allowed, false);
  e.release("a", "seats", 1);
  assert.equal(e.consume("a", "seats", 1).allowed, true); // freed slot usable
});

test("quota meter reports real utilization", () => {
  const e = new EntitlementRuntime();
  e.setSku("a", "starter"); // devices cap 5
  e.consume("a", "devices", 4);
  const m = e.meter("a");
  assert.equal(m.usage.devices, 4);
  assert.equal(m.remaining.devices, 1);
  assert.equal(m.utilization.devices, 0.8);
});

test("billing simulator is deterministic and overage-correct", () => {
  const team = skuById("team")!;
  const bill = simulateBill(team, { seats: 25, devices: 10, storageBytes: 110 * GB });
  // base 4000 + 25*300 + 10GB overage*15
  assert.equal(bill.subtotalINR, 4000 + 25 * 300 + 10 * 15);
  assert.equal(bill.simulationOnly, true);
  // deterministic: same inputs → identical result
  assert.deepEqual(simulateBill(team, { seats: 25, devices: 10, storageBytes: 110 * GB }), bill);
});

test("billing does not silently bill seats beyond the cap", () => {
  const starter = skuById("starter")!; // seat cap 3, perSeat 0
  const bill = simulateBill(starter, { seats: 99, devices: 0, storageBytes: 0 });
  const seatLine = bill.lines.find((l) => l.label === "Seats")!;
  assert.equal(seatLine.qty, 3); // capped, not 99
});

test("catalog SKUs all declare concrete caps", () => {
  for (const s of SKUS) {
    assert.ok(s.caps.seats > 0 && s.caps.devices > 0 && s.caps.storageBytes > 0);
  }
});
