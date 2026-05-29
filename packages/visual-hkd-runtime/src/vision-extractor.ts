import { loadVisualSource } from "./image-loader.ts";
import { splitTextByConfidence } from "./text-extractor.ts";
import type { VisionExtraction, VisualExtractionInput } from "./types.ts";

export function extractVisionArtifacts(input: VisualExtractionInput): VisionExtraction {
  const source = loadVisualSource(input);
  const { readableText, uncertainText } = splitTextByConfidence(input.textBlocks);

  return {
    source,
    panels: input.panels,
    readableText,
    uncertainText,
    icons: input.icons ?? [],
    relations: input.relations ?? []
  };
}
