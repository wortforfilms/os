import test from "node:test";
import assert from "node:assert/strict";
import { LipiAgent } from "../src/agent.ts";

test("lipi-agent wraps lipi-runtime character anchors and lineage data", async () => {
  const agent = new LipiAgent();
  const result = await agent.analyze("\u{11005}\u{11013}", "brahmi");

  assert.equal(result.isOk, true);
  assert.equal(result.data.script, "brahmi");
  assert.equal(result.data.evidence.scriptRecord, "brahmi");
  assert.ok(result.data.evidence.characterAnchors >= 2);
  assert.ok(result.data.evidence.lineageEdges.includes("brahmi-to-siddham"));
  assert.ok(result.data.suggestions.some((suggestion) => suggestion.text.includes("->")));
  assert.equal(result.data.lineage[0].runtime, "lipi-runtime");
});

test("lipi-agent learns corrections and suggests next action without claiming OCR or translation", async () => {
  const agent = new LipiAgent();
  const learned = await agent.learn({ correct: ["\u{11005} -> a"], wrong: ["fake"] });
  assert.equal(learned.isOk, true);
  assert.equal(learned.data.updated, true);
  assert.equal(learned.data.newKnowledge, 1);

  const suggestion = await agent.suggest("practice brahmi vowels");
  assert.equal(suggestion.isOk, true);
  assert.match(suggestion.data.rationale, /prior corrections/);
  assert.deepEqual(suggestion.data.examples, ["\u{11005} -> a"]);

  const inventory = agent.inventory();
  assert.equal(inventory.scripts, 426);
  assert.equal(inventory.knowledge, 1);
});
