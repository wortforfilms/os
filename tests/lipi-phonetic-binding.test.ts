import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bindToken, bindShiftTokens } from "../packages/lipi-runtime/src/phonetic-binding.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "unicode", "UnicodeData.txt");

test("bindToken returns real seeded IPA for seeded tokens", () => {
  assert.equal(bindToken("KA").ipa, "kə");
  assert.equal(bindToken("A").ipa, "ə");
  assert.equal(bindToken("KHA").ipa, "kʰə");
  assert.equal(bindToken("GA").ipa, "gə");
  // seeded values carry a review status, never "certified"
  assert.equal(bindToken("KA").status, "NEEDS_NATIVE_REVIEW");
  assert.ok(["lipi-runtime/phonetics/pronunciation-rules", "lipi-runtime/phonetics/ipa-map"].includes(bindToken("A").source));
});

test("bindToken is fail-closed on UNSEEDED tokens — IPA never invented", () => {
  for (const t of ["NA", "PA", "RA", "TTA", "VOCALIC R", "ZZZ"]) {
    const b = bindToken(t);
    assert.equal(b.ipa, null, `${t} must be UNKNOWN, not invented`);
    assert.equal(b.status, "UNKNOWN");
    assert.equal(b.source, null);
  }
});

test("bindShiftTokens reports honest coverage (small seeded, rest UNKNOWN)", () => {
  const cov = bindShiftTokens(DATA);
  assert.equal(cov.schema, "maataa.lipi.phonetic-binding.v1");
  assert.ok(cov.totalShiftTokens > 50, "many cross-script tokens");
  // only the seeded authority tokens (a, ka, kha, ga) can bind
  assert.ok(cov.seeded >= 1 && cov.seeded <= cov.authority.ipaMapEntries);
  assert.equal(cov.seeded + cov.unknown, cov.totalShiftTokens);
  assert.ok(cov.unknown > cov.seeded, "honest: most tokens remain UNKNOWN");
  assert.equal(cov.status, "CONTROLLED_NO_GO");
  assert.equal(cov.governedProductionGo, false);
});

test("every bound IPA traces to the in-repo authority (provenance, no fabrication)", () => {
  const cov = bindShiftTokens(DATA);
  for (const b of cov.bindings) {
    if (b.ipa !== null) {
      assert.ok(b.source && b.source.startsWith("lipi-runtime/phonetics/"), `${b.token} must cite the authority`);
    } else {
      assert.equal(b.source, null);
    }
  }
});
