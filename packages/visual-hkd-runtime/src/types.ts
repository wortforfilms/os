export type HKDStatus = "vision" | "specified" | "scaffolded" | "implemented" | "validated";

export type HKDSectionType =
  | "runtime"
  | "service"
  | "feature"
  | "dashboard"
  | "workflow"
  | "data"
  | "evidence";

export type RuntimeSuggestionStatus = "scaffolded" | "implemented";

export type MatrixStatus = "vision" | "specified" | "scaffolded" | "implemented" | "validated" | "blocked";

export type HKDBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HKDSourceRef = {
  sourceImage: string;
  sourceSectionId?: string;
  confidence: number;
};

export type HKDSection = HKDSourceRef & {
  id: string;
  title: string;
  type: HKDSectionType;
  bbox?: HKDBoundingBox;
};

export type HKDNode = HKDSourceRef & {
  id: string;
  label: string;
  kind: string;
  universe: string;
};

export type HKDEdge = HKDSourceRef & {
  from: string;
  to: string;
  relation: string;
  confidence: number;
};

export type HKDWidget = HKDSourceRef & {
  id: string;
  title: string;
  widgetType: "card" | "panel" | "graph" | "matrix" | "status" | "timeline";
  status: MatrixStatus;
};

export type HKDClaim = HKDSourceRef & {
  id: string;
  text: string;
  status: "UNVERIFIED" | "PARTIAL" | "BLOCKED";
  blockedReason?: string;
};

export type HKDEvidence = HKDSourceRef & {
  id: string;
  title: string;
  evidenceType: "source_image" | "ocr_block" | "panel_bbox" | "operator_note";
  hash?: string;
};

export type VisualHKD = {
  id: string;
  title: string;
  sourceImage: string;
  universe: string;
  sections: HKDSection[];
  nodes: HKDNode[];
  edges: HKDEdge[];
  widgets: HKDWidget[];
  claims: HKDClaim[];
  evidence: HKDEvidence[];
  status: HKDStatus;
};

export type VisionTextBlock = {
  id: string;
  text?: string;
  confidence: number;
  bbox?: HKDBoundingBox;
  sourceSectionId?: string;
};

export type VisionPanelCandidate = {
  id: string;
  title?: string;
  type?: HKDSectionType;
  confidence: number;
  bbox?: HKDBoundingBox;
};

export type VisionIconCandidate = {
  id: string;
  label?: string;
  confidence: number;
  bbox?: HKDBoundingBox;
  sourceSectionId?: string;
};

export type VisionRelationCandidate = {
  fromTextId: string;
  toTextId: string;
  relation: string;
  confidence: number;
  sourceSectionId?: string;
};

export type VisualExtractionInput = {
  id: string;
  title: string;
  sourceImage: string;
  universe: string;
  imageHash?: string;
  status?: HKDStatus;
  panels: VisionPanelCandidate[];
  textBlocks: VisionTextBlock[];
  icons?: VisionIconCandidate[];
  relations?: VisionRelationCandidate[];
  existingRuntimePackages?: string[];
};

export type VisualSource = {
  id: string;
  title: string;
  sourceImage: string;
  universe: string;
  imageHash?: string;
};

export type VisionExtraction = {
  source: VisualSource;
  panels: VisionPanelCandidate[];
  readableText: VisionTextBlock[];
  uncertainText: VisionTextBlock[];
  icons: VisionIconCandidate[];
  relations: VisionRelationCandidate[];
};

export type KnowledgeGraphProjection = {
  nodes: Array<{ id: string; label: string; kind: string; sourceImage: string; sourceSectionId?: string }>;
  edges: Array<{ from: string; to: string; relation: string; confidence: number; sourceImage: string; sourceSectionId?: string }>;
};

export type RuntimePackageSuggestion = {
  id: string;
  packageName: string;
  sourceSectionId: string;
  sourceImage: string;
  serviceContract: string;
  apiRoute: string;
  databaseModel: string;
  dashboardWidget: string;
  status: RuntimeSuggestionStatus;
  confidence: number;
};

export type RealityMatrixEntry = {
  id: string;
  title: string;
  status: MatrixStatus;
  sourceImage: string;
  sourceSectionId: string;
  reason: string;
};

export type VisualHKDValidationResult = {
  pass: boolean;
  productionReady: false;
  phkdVerdict: "BLOCKED" | "PASS";
  finalStatus: "GOVERNED_PRODUCTION_NO_GO";
  failures: string[];
  warnings: string[];
};
