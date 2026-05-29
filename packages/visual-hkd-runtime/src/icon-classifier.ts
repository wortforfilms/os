import type { HKDWidget, VisionIconCandidate, VisualSource } from "./types.ts";

export function classifyIcons(source: VisualSource, icons: VisionIconCandidate[] = []): HKDWidget[] {
  return icons.map((icon) => ({
    id: `widget-${icon.id}`,
    title: icon.label?.trim() || "UNREADABLE",
    widgetType: "status",
    status: icon.confidence >= 0.7 ? "specified" : "vision",
    sourceImage: source.sourceImage,
    sourceSectionId: icon.sourceSectionId,
    confidence: icon.label ? icon.confidence : Math.min(icon.confidence, 0.69)
  }));
}
