import type { VisualExtractionInput, VisualSource } from "./types.ts";

export function loadVisualSource(input: VisualExtractionInput): VisualSource {
  if (!input.id.trim()) throw new Error("visual source id is required");
  if (!input.title.trim()) throw new Error("visual source title is required");
  if (!input.sourceImage.trim()) throw new Error("source image reference is required");
  if (!input.universe.trim()) throw new Error("universe is required");

  return {
    id: input.id,
    title: input.title,
    sourceImage: input.sourceImage,
    universe: input.universe,
    imageHash: input.imageHash
  };
}
