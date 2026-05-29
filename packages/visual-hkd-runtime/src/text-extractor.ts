import type { VisionTextBlock } from "./types.ts";

export const READABLE_TEXT_CONFIDENCE = 0.7;

export function normalizeTextBlock(block: VisionTextBlock): VisionTextBlock {
  const text = block.text?.trim();
  return {
    ...block,
    text: text && block.confidence >= READABLE_TEXT_CONFIDENCE ? text : "UNREADABLE"
  };
}

export function splitTextByConfidence(blocks: VisionTextBlock[]): {
  readableText: VisionTextBlock[];
  uncertainText: VisionTextBlock[];
} {
  const normalized = blocks.map(normalizeTextBlock);
  return {
    readableText: normalized.filter((block) => block.confidence >= READABLE_TEXT_CONFIDENCE && block.text !== "UNREADABLE"),
    uncertainText: normalized.filter((block) => block.confidence < READABLE_TEXT_CONFIDENCE || block.text === "UNREADABLE")
  };
}
