import type { HKDSection, HKDWidget } from "./types.ts";

export function widgetsFromSections(sections: HKDSection[]): HKDWidget[] {
  return sections.map((section) => ({
    id: `widget-${section.id}`,
    title: section.title,
    widgetType: section.type === "dashboard" ? "matrix" : section.type === "workflow" ? "timeline" : "panel",
    status: section.confidence >= 0.7 ? "specified" : "vision",
    sourceImage: section.sourceImage,
    sourceSectionId: section.id,
    confidence: section.confidence
  }));
}
