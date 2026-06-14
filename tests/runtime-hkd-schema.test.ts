import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHkdUri, buildHkdUri, validateHkd, entitledStatus, health, HKD_CONTRACTS } from "../packages/runtime-hkd-schema/src/index.ts";
import type { HKD } from "../packages/runtime-hkd-schema/src/index.ts";

const goodUri = "hkd://maataa/core/schema/v1";

const baseHkd = (over: Partial<HKD> = {}): HKD => ({
  id: "hkd-1", uri: goodUri, title: "T", domain: "maataa", summary: "s", content: "c",
  assets: [], evidence: [], relations: [], blockers: [], status: "draft", ...over,
});

test("parseHkdUri parses the mockup grammar and fails closed", () => {
  const r = parseHkdUri(goodUri);
  assert.ok(r.isOk);
  assert.equal(r.data.domain, "maataa");
  assert.deepEqual(r.data.segments, ["core", "schema", "v1"]);
  assert.equal(r.data.path, "core/schema/v1");
  assert.equal(parseHkdUri("http://x/y").isOk, false);
  assert.equal(parseHkdUri("hkd://onlydomain").isOk, false);
  assert.equal(parseHkdUri("").isOk, false);
});

test("buildHkdUri round-trips and is fail-closed", () => {
  const b = buildHkdUri("lipi", ["sanskrit", "ashtadhyayi", "sutra", "1.1.1"]);
  assert.ok(b.isOk);
  assert.equal(b.data, "hkd://lipi/sanskrit/ashtadhyayi/sutra/1.1.1");
  assert.equal(parseHkdUri(b.data).data.domain, "lipi");
  assert.equal(buildHkdUri("", ["x"]).isOk, false);
  assert.equal(buildHkdUri("d", []).isOk, false);
});

test("validateHkd accepts a well-formed capsule", () => {
  const v = validateHkd(baseHkd());
  assert.ok(v.isOk);
});

test("validateHkd is fail-closed on missing fields, bad status, bad uri, bad evidence", () => {
  assert.equal(validateHkd(null).isOk, false);
  assert.equal(validateHkd(baseHkd({ id: "" })).isOk, false);
  assert.equal(validateHkd(baseHkd({ status: "live" as any })).isOk, false);
  assert.equal(validateHkd(baseHkd({ uri: "ftp://x/y" })).isOk, false);
  assert.equal(validateHkd(baseHkd({ assets: "no" as any })).isOk, false);
  assert.equal(validateHkd(baseHkd({ evidence: [{ sourcePath: "", provenance: "unknown" } as any] })).isOk, false);
  assert.equal(validateHkd(baseHkd({ evidence: [{ sourcePath: "a", provenance: "made-up" } as any] })).isOk, false);
});

test("entitledStatus enforces the capsule rule (verified needs source-proven + no blockers)", () => {
  // verified but no evidence → downgraded to preview
  const a = entitledStatus(baseHkd({ status: "verified" }));
  assert.ok(a.isOk);
  assert.equal(a.data.entitled, "preview");
  // verified with open blocker → downgraded to blocked
  const b = entitledStatus(baseHkd({ status: "verified", blockers: [{ id: "b1", reason: "missing sig" }] }));
  assert.equal(b.data.entitled, "blocked");
  // verified WITH source-proven evidence and no blockers → stays verified
  const c = entitledStatus(baseHkd({ status: "verified", evidence: [{ sourcePath: "f.ts", sha256: "ab", provenance: "source-proven" }] }));
  assert.equal(c.data.entitled, "verified");
  assert.equal(c.data.reasons.length, 0);
  // draft stays draft
  assert.equal(entitledStatus(baseHkd({ status: "draft" })).data.entitled, "draft");
});

test("contracts captured verbatim + health is not production-GO", () => {
  assert.equal(HKD_CONTRACTS.provenanceChain[0], "Source");
  assert.equal(HKD_CONTRACTS.coreApiRoutes.includes("/api/evidence"), true);
  const h = health();
  assert.equal(h.__meta.governedProductionGo, false);
  assert.deepEqual(h.evidence.statuses, ["draft", "preview", "verified", "blocked"]);
});
