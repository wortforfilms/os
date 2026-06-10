import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const manifest = JSON.parse(readFileSync("data/dashboard-figures.json", "utf8"));
const evidence = JSON.parse(readFileSync("release/evidence/agent-runtime.json", "utf8"));

test("every representative figure is flagged not-live and badged Illustrative", () => {
  for (const f of manifest.figures) {
    if (f.kind === "REPRESENTATIVE") {
      assert.equal(f.live, false, `${f.claimId} representative but live`);
      assert.match(f.badge, /Illustrative/, `${f.claimId} missing Illustrative badge`);
      assert.match(f.source, /vision board/i, `${f.claimId} representative must cite vision board, not a live source`);
    }
  }
});

test("a live figure must trace to a real evidence source", () => {
  const liveFigs = manifest.figures.filter((f) => f.live);
  assert.ok(liveFigs.length >= 1, "expected at least one live figure");
  for (const f of liveFigs) {
    assert.equal(f.kind, "LIVE");
    assert.match(f.source, /release\/evidence\//, `${f.claimId} live figure must point at evidence`);
  }
});

test("the live agent count equals the runtime evidence value", () => {
  const agent = manifest.figures.find((f) => f.claimId === "c-active-agents-12");
  assert.ok(agent, "agent-count figure present");
  assert.equal(agent.live, true);
  assert.equal(agent.numeric, evidence.activeAgents);
});

test("no fabricated headline number is presented as live", () => {
  // None of the known fabricated stats may carry live:true.
  const fabricated = ["c-deployed-1248", "c-tasks-24h-2-47m", "c-success-98-72", "c-marketplace-1248"];
  for (const id of fabricated) {
    const f = manifest.figures.find((x) => x.claimId === id);
    if (f) assert.equal(f.live, false, `${id} must not be live`);
  }
});
