import { lipiCharacterMatrix } from "../characters/character-matrix";

export function evaluatePracticeAnswer(anchorId: string, answer: string) {
  const anchor = lipiCharacterMatrix.find((character) => character.id === anchorId);
  if (!anchor) return { status: "BLOCKED", correct: false, reason: "Unknown anchor id." };
  return {
    status: anchor.anchorStatus === "BLOCKED" ? "BLOCKED" : "PREVIEW",
    correct: answer.trim().toLowerCase() === anchor.transliteration?.toLowerCase(),
    reason: anchor.anchorStatus === "SEEDED" ? "Seeded answer, not yet certified." : anchor.anchorStatus,
  };
}
