import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tree = JSON.parse(readFileSync("data/maataa-ecosystem-merkle-tree.json", "utf8"));

test("Maataa ecosystem tree has eight level-one domains", () => {
  assert.equal(tree.domains.length, 8);
});

test("Maataa ecosystem tree captures all extracted sub-domain frames", () => {
  const frameCount = tree.domains.reduce((sum, domain) => sum + domain.frames.length, 0);
  assert.equal(frameCount, 65);
});

test("Maataa ecosystem tree has ten frame types and ten data categories", () => {
  assert.equal(tree.frameTypes.length, 10);
  assert.equal(tree.dataCategories.length, 10);
});

test("Maataa ecosystem root hash remains explicitly unverified", () => {
  assert.equal(tree.source.rootHashVerified, false);
  assert.equal(tree.governance.productionReady, false);
  assert.equal(tree.governance.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(tree.governance.activeBlockers.includes("root_hash_image_label_not_cryptographically_verified"), true);
});
