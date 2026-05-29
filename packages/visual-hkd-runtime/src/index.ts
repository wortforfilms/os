export type {
  HKDBoundingBox,
  HKDClaim,
  HKDEdge,
  HKDEvidence,
  HKDNode,
  HKDSection,
  HKDSectionType,
  HKDStatus,
  HKDWidget,
  KnowledgeGraphProjection,
  MatrixStatus,
  RealityMatrixEntry,
  RuntimePackageSuggestion,
  RuntimeSuggestionStatus,
  VisionExtraction,
  VisionIconCandidate,
  VisionPanelCandidate,
  VisionRelationCandidate,
  VisionTextBlock,
  VisualExtractionInput,
  VisualHKD,
  VisualHKDValidationResult,
  VisualSource
} from "./types.ts";

export { loadVisualSource } from "./image-loader.ts";
export { extractVisionArtifacts } from "./vision-extractor.ts";
export { detectPanels } from "./panel-detector.ts";
export { splitTextByConfidence, normalizeTextBlock, READABLE_TEXT_CONFIDENCE } from "./text-extractor.ts";
export { classifyIcons } from "./icon-classifier.ts";
export { widgetsFromSections } from "./layout-parser.ts";
export { generateVisualHKD } from "./hkd-generator.ts";
export { ingestVisualHKDToGraph } from "./graph-ingestor.ts";
export { generateRealityMatrixEntries, generateRuntimeSuggestions } from "./runtime-generator.ts";
export { validateVisualHKDStatus } from "./status-validator.ts";
