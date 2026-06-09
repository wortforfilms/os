import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  KG_RELATION_TYPES,
  createRelationStore,
  type KgRelationType,
  type RelationEdgeInput,
} from "../../packages/kbs-graph/src/index.ts";

const createdAt = "2026-06-09T20:42:31Z";

const edge = (
  id: string,
  type: KgRelationType,
  from = `${id}:from`,
  to = `${id}:to`,
  metadata = { source: "relation-store-test" },
): RelationEdgeInput => ({ id, from, to, type, createdAt, metadata });

const mustAdd = (store: ReturnType<typeof createRelationStore>, input: RelationEdgeInput) => {
  const result = store.addEdge(input);
  assert.equal(result.isOk, true, result.error?.message);
  return result.data!;
};

test("stores all 13 allowed relation types", () => {
  const store = createRelationStore();

  for (const type of KG_RELATION_TYPES) {
    const stored = mustAdd(store, edge(`edge:${type}`, type));
    assert.equal(stored.type, type);
  }

  assert.equal(store.listEdges().length, 13);
});

test("rejects unknown relation type", () => {
  const store = createRelationStore();
  const result = store.addEdge(edge("bad:type", "CITES" as KgRelationType));

  assert.equal(result.isOk, false);
  assert.equal(result.error!.code, "invalid_edge");
  assert.match(result.error!.message, /unknown KG relation type/);
});

test("rejects empty endpoints", () => {
  const store = createRelationStore();

  const result = store.addEdge(edge("bad:endpoint", "USES", "   ", "target"));

  assert.equal(result.isOk, false);
  assert.equal(result.error!.code, "invalid_edge");
  assert.deepEqual(result.error!.details, ["missing 'from'"]);
});

test("rejects invalid self relation", () => {
  const store = createRelationStore();

  const result = store.addEdge(edge("bad:self", "IS_A", "node:a", "node:a"));

  assert.equal(result.isOk, false);
  assert.equal(result.error!.code, "invalid_edge");
  assert.deepEqual(result.error!.details, ["self-relation not allowed (from === to)"]);
});

test("canonicalizes RELATED_TO symmetric edge", () => {
  const store = createRelationStore();

  const stored = mustAdd(store, edge("related:1", "RELATED_TO", "z-node", "a-node"));
  assert.equal(stored.from, "a-node");
  assert.equal(stored.to, "z-node");

  const duplicate = store.addEdge(edge("related:2", "RELATED_TO", "a-node", "z-node"));
  assert.equal(duplicate.isOk, false);
  assert.equal(duplicate.error!.code, "duplicate_edge");
});

test("outgoing query works", () => {
  const store = createRelationStore();
  mustAdd(store, edge("uses:1", "USES", "app", "runtime"));
  mustAdd(store, edge("depends:1", "DEPENDS_ON", "app", "storage"));

  assert.deepEqual(
    store.findOutgoing("app", "USES").map((item) => item.id),
    ["uses:1"],
  );
});

test("incoming query works", () => {
  const store = createRelationStore();
  mustAdd(store, edge("created:1", "CREATED_BY", "artifact", "maker"));
  mustAdd(store, edge("mentions:1", "MENTIONS", "doc", "maker"));

  assert.deepEqual(
    store.findIncoming("maker", "CREATED_BY").map((item) => item.id),
    ["created:1"],
  );
});

test("findBetween works", () => {
  const store = createRelationStore();
  mustAdd(store, edge("between:directed", "DEPENDS_ON", "app", "db"));
  mustAdd(store, edge("between:symmetric", "RELATED_TO", "z", "a"));

  assert.deepEqual(
    store.findBetween("app", "db", "DEPENDS_ON").map((item) => item.id),
    ["between:directed"],
  );
  assert.deepEqual(
    store.findBetween("z", "a", "RELATED_TO").map((item) => item.id),
    ["between:symmetric"],
  );
});

test("traversal respects maxDepth", () => {
  const store = createRelationStore();
  mustAdd(store, edge("depth:1", "DEPENDS_ON", "a", "b"));
  mustAdd(store, edge("depth:2", "DEPENDS_ON", "b", "c"));
  mustAdd(store, edge("depth:3", "DEPENDS_ON", "c", "d"));

  const depthOne = store.traverse("a", { maxDepth: 1, type: "DEPENDS_ON" });
  assert.equal(depthOne.isOk, true);
  assert.deepEqual(depthOne.data!.visitedNodes, ["a", "b"]);
  assert.deepEqual(depthOne.data!.traversedEdgeIds, ["depth:1"]);

  const depthTwo = store.traverse("a", { maxDepth: 2, type: "DEPENDS_ON" });
  assert.equal(depthTwo.isOk, true);
  assert.deepEqual(depthTwo.data!.visitedNodes, ["a", "b", "c"]);
  assert.deepEqual(depthTwo.data!.traversedEdgeIds, ["depth:1", "depth:2"]);
});

test("traversal is cycle-safe", () => {
  const store = createRelationStore();
  mustAdd(store, edge("cycle:1", "DEPENDS_ON", "a", "b"));
  mustAdd(store, edge("cycle:2", "DEPENDS_ON", "b", "c"));
  mustAdd(store, edge("cycle:3", "DEPENDS_ON", "c", "a"));

  const result = store.traverse("a", { maxDepth: 8, type: "DEPENDS_ON" });

  assert.equal(result.isOk, true);
  assert.deepEqual(result.data!.visitedNodes, ["a", "b", "c"]);
  assert.deepEqual(result.data!.traversedEdgeIds, ["cycle:1", "cycle:2", "cycle:3"]);
});

test("traversal ordering is deterministic", () => {
  const store = createRelationStore();
  mustAdd(store, edge("order:z", "DEPENDS_ON", "root", "z"));
  mustAdd(store, edge("order:a", "DEPENDS_ON", "root", "a"));
  mustAdd(store, edge("order:m", "DEPENDS_ON", "root", "m"));

  const first = store.traverse("root", { maxDepth: 1, type: "DEPENDS_ON" });
  const second = store.traverse("root", { maxDepth: 1, type: "DEPENDS_ON" });

  assert.equal(first.isOk, true);
  assert.equal(second.isOk, true);
  assert.deepEqual(first.data, second.data);
  assert.deepEqual(first.data!.visitedNodes, ["a", "m", "root", "z"]);
  assert.deepEqual(first.data!.traversedEdgeIds, ["order:a", "order:m", "order:z"]);
});

test("domain helpers return expected edges", () => {
  const store = createRelationStore();
  mustAdd(store, edge("domain:dependency", "DEPENDS_ON", "app", "storage"));
  mustAdd(store, edge("domain:part", "PART_OF", "wheel", "car"));
  mustAdd(store, edge("domain:owner", "OWNS", "operator", "asset"));
  mustAdd(store, edge("domain:teaches", "TEACHES", "teacher", "student"));
  mustAdd(store, edge("domain:learned", "LEARNED_FROM", "student", "mentor"));
  mustAdd(store, edge("domain:invest", "INVESTS_IN", "investor", "venture"));

  assert.deepEqual(store.findDependencies("app").map((item) => item.id), ["domain:dependency"]);
  assert.deepEqual(store.findParts("car").map((item) => item.id), ["domain:part"]);
  assert.deepEqual(store.findOwners("asset").map((item) => item.id), ["domain:owner"]);
  assert.deepEqual(
    store.findLearningLineage("student").map((item) => item.id),
    ["domain:learned", "domain:teaches"],
  );
  assert.deepEqual(store.findInvestmentLinks("venture").map((item) => item.id), ["domain:invest"]);
});

test("explainEdge returns type metadata and inverse info", () => {
  const store = createRelationStore();
  mustAdd(store, edge("explain:teaches", "TEACHES", "teacher", "student"));

  const explanation = store.explainEdge("explain:teaches");

  assert.equal(explanation.isOk, true);
  assert.equal(explanation.data!.relation.type, "TEACHES");
  assert.equal(explanation.data!.relation.category, "pedagogic");
  assert.equal(explanation.data!.inverseType, "LEARNED_FROM");
  assert.equal(explanation.data!.inverseEdges[0].from, "student");
  assert.equal(explanation.data!.inverseEdges[0].to, "teacher");
  assert.equal(explanation.data!.inverseEdges[0].type, "LEARNED_FROM");
  assert.equal(explanation.data!.graphDatabase, false);
  assert.equal(explanation.data!.productionReady, false);
  assert.equal(explanation.data!.reasoningEngine, false);
});

test("evidence does not emit graph database or production-ready claims", () => {
  const evidence = JSON.parse(readFileSync("release/evidence/kbs-graph-relation-store.json", "utf8"));

  assert.equal(evidence.relationTypesTotal, 13);
  assert.equal(evidence.storage, "local/in-memory");
  assert.equal(evidence.graphDatabase, false);
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.traversalImplemented, true);
  assert.equal(evidence.reasoningEngine, false);
  assert.equal(evidence.finalStatus, "CONTROLLED_NO_GO");
});
