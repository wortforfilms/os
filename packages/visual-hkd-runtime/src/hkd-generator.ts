import { classifyIcons } from "./icon-classifier.ts";
import { widgetsFromSections } from "./layout-parser.ts";
import { detectPanels } from "./panel-detector.ts";
import { extractVisionArtifacts } from "./vision-extractor.ts";
import type { HKDClaim, HKDEdge, HKDEvidence, HKDNode, VisualExtractionInput, VisualHKD } from "./types.ts";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "unreadable";
}

function inferKind(text: string): string {
  if (/runtime/i.test(text)) return "RUNTIME";
  if (/api|sdk/i.test(text)) return "API";
  if (/dashboard|board/i.test(text)) return "DASHBOARD";
  if (/evidence|proof|claim/i.test(text)) return "EVIDENCE";
  return "CONCEPT";
}

export function generateVisualHKD(input: VisualExtractionInput): VisualHKD {
  const extraction = extractVisionArtifacts(input);
  const sections = detectPanels(extraction.source, extraction.panels);
  const sectionIds = new Set(sections.map((section) => section.id));
  const readableById = new Map(extraction.readableText.map((block) => [block.id, block]));

  const nodes: HKDNode[] = extraction.readableText.map((block) => ({
    id: `node-${slug(block.text ?? block.id)}`,
    label: block.text ?? "UNREADABLE",
    kind: inferKind(block.text ?? ""),
    universe: extraction.source.universe,
    sourceImage: extraction.source.sourceImage,
    sourceSectionId: block.sourceSectionId && sectionIds.has(block.sourceSectionId) ? block.sourceSectionId : undefined,
    confidence: block.confidence
  }));

  const edges: HKDEdge[] = extraction.relations
    .filter((relation) => readableById.has(relation.fromTextId) && readableById.has(relation.toTextId))
    .map((relation) => {
      const from = readableById.get(relation.fromTextId);
      const to = readableById.get(relation.toTextId);
      return {
        from: `node-${slug(from?.text ?? relation.fromTextId)}`,
        to: `node-${slug(to?.text ?? relation.toTextId)}`,
        relation: relation.relation,
        confidence: relation.confidence,
        sourceImage: extraction.source.sourceImage,
        sourceSectionId: relation.sourceSectionId
      };
    });

  const claims: HKDClaim[] = extraction.readableText
    .filter((block) => /verified|certified|production|scientific/i.test(block.text ?? ""))
    .map((block) => ({
      id: `claim-${slug(block.text ?? block.id)}`,
      text: block.text ?? "UNREADABLE",
      status: "UNVERIFIED",
      blockedReason: "visual extraction cannot verify operational, scientific, or production claims",
      sourceImage: extraction.source.sourceImage,
      sourceSectionId: block.sourceSectionId,
      confidence: block.confidence
    }));

  const evidence: HKDEvidence[] = [
    {
      id: `evidence-source-${slug(extraction.source.id)}`,
      title: extraction.source.title,
      evidenceType: "source_image",
      hash: extraction.source.imageHash,
      sourceImage: extraction.source.sourceImage,
      confidence: extraction.source.imageHash ? 1 : 0.5
    },
    ...sections.map((section) => ({
      id: `evidence-panel-${section.id}`,
      title: section.title,
      evidenceType: "panel_bbox" as const,
      sourceImage: extraction.source.sourceImage,
      sourceSectionId: section.id,
      confidence: section.confidence
    })),
    ...extraction.uncertainText.map((block) => ({
      id: `evidence-uncertain-${block.id}`,
      title: "UNREADABLE",
      evidenceType: "ocr_block" as const,
      sourceImage: extraction.source.sourceImage,
      sourceSectionId: block.sourceSectionId,
      confidence: block.confidence
    }))
  ];

  return {
    id: input.id,
    title: input.title,
    sourceImage: input.sourceImage,
    universe: input.universe,
    sections,
    nodes,
    edges,
    widgets: [...widgetsFromSections(sections), ...classifyIcons(extraction.source, extraction.icons)],
    claims,
    evidence,
    status: input.status ?? "vision"
  };
}
