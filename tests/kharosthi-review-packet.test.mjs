import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("Kharosthi review invitations are prepared but not falsely delivered", () => {
  assert.equal(existsSync("data/lipi-review-invitations.json"), true, "run scripts/generate-kharosthi-review-packet.mjs first");
  const invites = JSON.parse(readFileSync("data/lipi-review-invitations.json", "utf8"));

  assert.equal(invites.subject.scriptId, "kharosthi");
  assert.equal(invites.subject.candidateTextId, "kharosthi-wardak-vase-line-4");
  assert.equal(invites.invitations.length, 3);
  for (const invite of invites.invitations) {
    assert.equal(invite.status, "READY_TO_SEND");
    assert.equal(invite.deliveryStatus, "NOT_SENT_NO_CONTACT");
    assert.equal(invite.contact, "TO_BE_ASSIGNED");
    assert.ok(invite.evidenceBundle.length >= 2);
    assert.ok(
      invite.evidenceBundle.includes("release/evidence/indian-epigraphy-source-proof.json"),
      `${invite.id} must include the Indian Epigraphy source proof`,
    );
  }
});

test("Kharosthi corpus candidate is linked to the script but remains review-pending", () => {
  const corpus = JSON.parse(readFileSync("data/lipi-corpus-texts.json", "utf8"));
  const text = corpus.texts.find((t) => t.id === "kharosthi-wardak-vase-line-4");

  assert.ok(text, "expected Kharosthi corpus candidate");
  assert.equal(text.scriptId, "kharosthi");
  assert.equal(text.language, "pgd");
  assert.equal(text.reviewState, "CONTROLLED_NO_GO");
  assert.equal(text.certificationTarget, true);
  assert.equal(text.certificationStatus, "AWAITING_REVIEW");
  assert.match(text.textHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(text.provenance.some((p) => p.sourceId === "wardak-vase-wikipedia"));
  assert.ok(text.provenance.some((p) => p.sourceId === "indian-epigraphy-salomon-1998"));
});

test("certification ledger starts empty, so Kharosthi text is not certified by invitation", () => {
  const certifications = JSON.parse(readFileSync("data/lipi-review-certifications.json", "utf8"));
  const evidence = JSON.parse(readFileSync("release/evidence/kharosthi-review-packet.json", "utf8"));

  assert.deepEqual(certifications.certifications, []);
  assert.equal(evidence.certifiedKharosthiCorpusTexts, 0);
  assert.equal(evidence.externalMessagesSent, 0);
  assert.equal(evidence.indianEpigraphySourceProof, "release/evidence/indian-epigraphy-source-proof.json");
  assert.equal(evidence.reviewState, "CONTROLLED_NO_GO");
  assert.equal(evidence.governedProductionGo, false);
});

test("Indian Epigraphy PDF is recorded as reviewer-support source proof, not certification", () => {
  const source = JSON.parse(readFileSync("release/evidence/indian-epigraphy-source-proof.json", "utf8"));

  assert.equal(source.source.sourceId, "indian-epigraphy-salomon-1998");
  assert.match(source.source.sha256, /^([a-f0-9]{64}|LOCAL_FILE_NOT_PRESENT)$/);
  assert.ok(source.source.extractedHits.length >= 3);
  assert.equal(source.certificationEffect, "NONE_BY_ITSELF");
  assert.equal(source.reviewState, "CONTROLLED_NO_GO");
});

test("raw Kharosthi corpus link does not satisfy certified corpus-link criterion", () => {
  const progress = JSON.parse(readFileSync("release/evidence/lipi-revival-progress.json", "utf8"));
  const raw = progress.measured.rawCorpusLinks.find((l) => l.scriptId === "kharosthi");
  const certified = progress.measured.certifiedCorpusLinks.find((l) => l.scriptId === "kharosthi");

  assert.equal(raw?.count, 1);
  assert.equal(certified, undefined);
  assert.equal(progress.measured.perCriterion["corpus-link"], 0);
});
