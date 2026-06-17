import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const DATA = "release/evidence/lipi-endangerment-dashboard.json";
const HTML = "release/LIPI_ENDANGERMENT_DASHBOARD.html";

test("dashboard data + html surface are generated", () => {
  assert.equal(existsSync(DATA), true, "run scripts/generate-lipi-endangerment-dashboard.mjs first");
  assert.equal(existsSync(HTML), true);
});

const dash = JSON.parse(readFileSync(DATA, "utf8"));
const runtime = JSON.parse(readFileSync("packages/lipi-runtime/release/evidence/lipi-endangered-scripts.json", "utf8"));

test("dashboard reflects the runtime ENDANGERED set exactly", () => {
  assert.equal(dash.scripts.length, runtime.counts.total);
  assert.equal(dash.counts.total, runtime.counts.total);
  assert.deepEqual(dash.counts.byVitality, runtime.counts.byVitality);
});

test("every script holds the review posture and carries provenance", () => {
  for (const s of dash.scripts) {
    assert.equal(s.reviewState, "CONTROLLED_NO_GO", `${s.id} must be CONTROLLED_NO_GO`);
    assert.equal(s.status, "ENDANGERED", `${s.id} runtime status must be ENDANGERED`);
    assert.ok(s.provenanceCount >= 1, `${s.id} must carry provenance`);
  }
});

test("the surface makes no AFFIRMATIVE production / certification claim", () => {
  assert.equal(dash.governedProductionGo, false);
  assert.equal(dash.reviewState, "CONTROLLED_NO_GO");
  const html = readFileSync(HTML, "utf8");
  assert.match(html, /REVIEW ONLY/);
  assert.match(html, /CONTROLLED_NO_GO/);
  // Honest negations ("no live metrics", "governedProductionGo=false") are allowed;
  // only affirmative GO/ready/certified claims are forbidden.
  assert.doesNotMatch(html, /production[\s_-]?ready\s*[:=]\s*(?:true|yes)/i);
  assert.doesNotMatch(html, /\bGOVERNED_PRODUCTION_GO\b/);
  assert.doesNotMatch(html, /\bcertified\b/i);
  assert.doesNotMatch(html, /\bproduction[-\s]?ready\b/i); // no standalone "production ready" claim
});

test("sample codepoints are well-formed where present", () => {
  for (const s of dash.scripts) {
    for (const c of s.sampleCodepoints) {
      assert.match(c.cp, /^U\+[0-9A-F]{4,6}$/, `${s.id} codepoint ${c.cp} malformed`);
      assert.ok(typeof c.char === "string" && c.char.length >= 1, `${s.id} codepoint missing glyph`);
      assert.ok(typeof c.name === "string" && c.name.length > 0, `${s.id} codepoint missing name`);
    }
  }
});

test("counts are internally consistent", () => {
  const sum = Object.values(dash.counts.byVitality).reduce((a, b) => a + b, 0);
  assert.equal(sum, dash.counts.total);
  assert.ok(dash.counts.encoded + dash.counts.notEncoded <= dash.counts.total);
  assert.ok(dash.counts.nativeNameVerified <= dash.counts.total);
});
