// Real tests for the 13-type knowledge-graph relation taxonomy. No mocks.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KG_RELATION_TYPES,
  RELATION_TYPE_SPECS,
  isKgRelationType,
  assertRelationType,
  inverseOf,
  getRelationSpec,
  validateRelationEdge,
  canonicalizeEdge,
} from "../packages/kbs-graph/src/relation-types.ts";

const EXPECTED = [
  "IS_A", "PART_OF", "RELATED_TO", "CAUSED_BY", "DEPENDS_ON", "CREATED_BY",
  "USES", "MENTIONS", "LOCATED_IN", "OWNS", "INVESTS_IN", "TEACHES", "LEARNED_FROM",
];

test("exactly the 13 board-specified relation types exist", () => {
  assert.equal(KG_RELATION_TYPES.length, 13);
  assert.deepEqual([...KG_RELATION_TYPES], EXPECTED);
});

test("every type has a complete, well-formed spec", () => {
  for (const t of KG_RELATION_TYPES) {
    const s = getRelationSpec(t);
    assert.equal(s.type, t);
    assert.ok(s.description.length > 0);
    assert.ok(s.category.length > 0);
    assert.equal(typeof s.directed, "boolean");
    assert.equal(typeof s.symmetric, "boolean");
  }
});

test("inverse relations are mutually consistent", () => {
  for (const t of KG_RELATION_TYPES) {
    const inv = inverseOf(t);
    if (inv) assert.equal(inverseOf(inv), t, `${t} <-> ${inv} not mutual`);
  }
  assert.equal(inverseOf("TEACHES"), "LEARNED_FROM");
  assert.equal(inverseOf("LEARNED_FROM"), "TEACHES");
});

test("RELATED_TO is the only symmetric type; symmetric ⇒ self-inverse", () => {
  const symmetric = KG_RELATION_TYPES.filter((t) => RELATION_TYPE_SPECS[t].symmetric);
  assert.deepEqual(symmetric, ["RELATED_TO"]);
  assert.equal(inverseOf("RELATED_TO"), "RELATED_TO");
});

test("type guard + assert are fail-closed", () => {
  assert.equal(isKgRelationType("IS_A"), true);
  assert.equal(isKgRelationType("CITES"), false); // a KBS edge type, not a KG relation
  assert.equal(isKgRelationType("bogus"), false);
  assert.throws(() => assertRelationType("bogus"), /unknown KG relation type/);
});

test("edge validation accepts valid edges and rejects bad ones", () => {
  assert.equal(validateRelationEdge({ from: "a", to: "b", type: "IS_A" }).valid, true);
  assert.deepEqual(validateRelationEdge({ from: "a", to: "a", type: "IS_A" }).errors, ["self-relation not allowed (from === to)"]);
  assert.equal(validateRelationEdge({ from: "a", to: "b", type: "NOPE" }).valid, false);
  assert.equal(validateRelationEdge({ from: "", to: "b", type: "USES" }).valid, false);
});

test("symmetric edges canonicalize deterministically", () => {
  const a = canonicalizeEdge({ from: "z", to: "a", type: "RELATED_TO" });
  assert.deepEqual(a, { from: "a", to: "z", type: "RELATED_TO" });
  const d = canonicalizeEdge({ from: "z", to: "a", type: "IS_A" }); // directed: unchanged
  assert.deepEqual(d, { from: "z", to: "a", type: "IS_A" });
});
