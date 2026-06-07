import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, define, send, state, can, history, restart, snapshot, health } from "../packages/runtime-fsm/src/index.ts";

const REVIEW = {
  states: ["draft", "review", "approved", "rejected"],
  initial: "draft",
  transitions: [
    { from: "draft", event: "submit", to: "review" },
    { from: "review", event: "approve", to: "approved" },
    { from: "review", event: "reject", to: "rejected" },
    { from: "rejected", event: "revise", to: "draft" },
  ],
};

test("define validates states/initial/transitions and rejects non-determinism", () => {
  reset();
  const d = define(REVIEW);
  assert.ok(d.isOk);
  assert.equal(d.data.states, 4);
  assert.equal(d.data.transitions, 4);
  assert.equal(define({ states: [], initial: "x", transitions: [] }).isOk, false);
  assert.equal(define({ states: ["a"], initial: "z", transitions: [] }).isOk, false);
  assert.equal(define({ states: ["a", "b"], initial: "a", transitions: [{ from: "a", event: "e", to: "ghost" }] }).isOk, false);
  assert.equal(
    define({ states: ["a", "b"], initial: "a", transitions: [{ from: "a", event: "e", to: "b" }, { from: "a", event: "e", to: "a" }] }).isOk,
    false,
  );
});

test("send transitions deterministically and fails closed on undefined edges", () => {
  reset();
  define(REVIEW);
  assert.equal(state().data.state, "draft");
  assert.equal(send("approve").isOk, false); // no edge from draft
  assert.ok(send("submit").isOk);
  assert.equal(state().data.state, "review");
  assert.ok(send("approve").isOk);
  assert.equal(state().data.state, "approved");
});

test("state returns the current state and fails closed when undefined", () => {
  reset();
  assert.equal(state().isOk, false); // no machine defined
  define(REVIEW);
  assert.equal(state().data.state, "draft");
  send("submit");
  assert.equal(state().data.state, "review");
});

test("can reports allowed transitions without side effects", () => {
  reset();
  define(REVIEW);
  assert.deepEqual(can("submit").data, { allowed: true, to: "review" });
  assert.deepEqual(can("approve").data, { allowed: false, to: null });
  assert.equal(state().data.state, "draft"); // unchanged
});

test("history records every transition in order for audit", () => {
  reset();
  define(REVIEW);
  send("submit"); send("reject"); send("revise");
  const h = history();
  assert.equal(h.data.count, 3);
  assert.deepEqual(h.data.entries.map((e) => e.event), ["submit", "reject", "revise"]);
  assert.equal(h.data.entries[0].at < h.data.entries[1].at, true);
});

test("restart returns to initial and clears history; keeps definition", () => {
  reset();
  define(REVIEW);
  send("submit");
  assert.equal(restart().data.state, "draft");
  assert.equal(history().data.count, 0);
  assert.ok(send("submit").isOk); // definition retained
});

test("snapshot is deterministic and health is not production-GO", () => {
  reset();
  assert.equal(snapshot().isOk, false); // undefined machine fails closed
  define(REVIEW);
  const s = snapshot();
  assert.deepEqual(s.data.states, ["approved", "draft", "rejected", "review"]);
  assert.equal(s.data.transitions.length, 4);
  const h = health();
  assert.equal(h.evidence.defined, true);
  assert.equal(h.__meta.governedProductionGo, false);
});
