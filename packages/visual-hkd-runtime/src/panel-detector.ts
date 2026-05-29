import type { HKDSection, VisualSource, VisionPanelCandidate } from "./types.ts";

const DEFAULT_SECTION_TYPE = "feature";

export function detectPanels(source: VisualSource, panels: VisionPanelCandidate[]): HKDSection[] {
  return panels.map((panel, index) => ({
    id: panel.id || `panel-${index + 1}`,
    title: panel.title?.trim() || "UNREADABLE",
    type: panel.type || DEFAULT_SECTION_TYPE,
    bbox: panel.bbox,
    sourceImage: source.sourceImage,
    sourceSectionId: panel.id,
    confidence: panel.title ? panel.confidence : Math.min(panel.confidence, 0.69)
  }));
}
