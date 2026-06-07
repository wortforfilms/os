import { test } from "node:test";
import assert from "node:assert/strict";
import { LipiAgent } from "../packages/lipi-runtime/src/agent.ts";

test("lipi-agent: analyze drives real lipi-runtime script detection + lineage", async () => {
  const agent = new LipiAgent();
  const r = await agent.analyze("नमस्ते"); // Devanagari
  assert.ok(r.isOk, JSON.stringify(r.error));
  assert.equal(r.data.script, "devanagari");
  assert.ok(r.data.confidence > 0);
  assert.equal(r.data.evidence.scope, "transliteration-lineage-wrapper");
  assert.ok(r.data.lineage.length >= 1);
});

test("lipi-agent: fail-closed on unknown script and empty input", async () => {
  const agent = new LipiAgent();
  const bad = await agent.analyze("");
  assert.equal(bad.isOk, false);
  const unknown = await agent.analyze("hello", "no-such-script");
  assert.equal(unknown.isOk, false);
  assert.equal(unknown.error.code, "unknown_script");
});

test("lipi-agent: suggest + learn update advisory knowledge", async () => {
  const agent = new LipiAgent();
  const s = await agent.suggest("transliterate");
  assert.ok(s.isOk);
  assert.ok(typeof s.data.nextAction === "string");

  const l = await agent.learn({ correct: ["क -> ka", "ख -> kha"], wrong: [] });
  assert.ok(l.isOk);
  assert.equal(l.data.newKnowledge, 2);
  assert.equal(l.data.updated, true);

  const inv = agent.inventory();
  assert.ok(inv.scripts > 0);
  assert.equal(inv.knowledge, 2);
});
