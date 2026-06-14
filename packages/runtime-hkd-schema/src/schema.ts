/*
 * @maataa/runtime-hkd-schema — canonical HKD (Holistic Knowledge Document) capsule contract.
 *
 * PROVENANCE: absorbed from operator vision-board mockups (maataa_hkd_runtime_all_pages.html,
 * maataa_core_infrastructure_all_pages.html, maataa_knowledge_runtime_all_pages.html).
 * The `interface HKD` and the hkd:// URI grammar are taken verbatim from the mockup's
 * Schema/URI pages. Supporting types (HKDAsset/HKDEvidence/HKDRelation/HKDBlocker) and the
 * enums are reconstructed from the field descriptions on the mockup's Evidence / Provenance /
 * Relations / Assets / Validation pages.
 *
 * HONEST SCOPE: this is a SCHEMA + validation contract only. The mockups' numbers
 * (4,000+ HKDs, 150K/1M targets, % coverage) are fabricated and are NOT absorbed.
 */

/** Capsule lifecycle status (verbatim from the mockup's `interface HKD`). */
export type HKDStatus = "draft" | "preview" | "verified" | "blocked";

/** Provenance trust state (from the Provenance page: source-proven / operator-prompt / unknown). */
export type HKDProvenance = "source-proven" | "operator-prompt" | "unknown";

/** Asset readiness (from the Assets table: generated / planned / missing). */
export type HKDAssetStatus = "generated" | "planned" | "missing";

/** An asset bundled with a capsule (Assets page: Images/3D/PDF/CSV/HTML/JSON/code/schemas...). */
export interface HKDAsset {
  name: string;
  type: string; // e.g. "HTML" | "3D" | "signature" | "JSON" ...
  status: HKDAssetStatus;
}

/** An evidence record backing a claim (Evidence page: source_path required, sha256, operator claim). */
export interface HKDEvidence {
  sourcePath: string;
  sha256?: string;
  provenance: HKDProvenance;
}

/** A typed relation between capsules (Relations page: depends_on / uses / belongs_to ...). */
export interface HKDRelation {
  source: string;
  relation: string;
  target: string;
}

/** A release blocker (Blockers/Validation pages). */
export interface HKDBlocker {
  id: string;
  reason: string;
  severity?: "low" | "medium" | "high";
}

/** Canonical HKD capsule (interface taken verbatim from the mockup Schema page, typed strictly). */
export interface HKD {
  id: string;
  uri: string;
  title: string;
  domain: string;
  summary: string;
  content: string;
  assets: HKDAsset[];
  evidence: HKDEvidence[];
  relations: HKDRelation[];
  blockers: HKDBlocker[];
  status: HKDStatus;
}

/** Parsed hkd:// URI (grammar from the URI page: scheme=hkd://, domain, path). */
export interface HKDUri {
  scheme: "hkd";
  domain: string;
  segments: string[];
  path: string;
}

/** Data-flow + API contracts captured verbatim from the mockup code blocks (descriptive). */
export const HKD_CONTRACTS = {
  provenanceChain: ["Source", "Extractor", "HKD Capsule", "Evidence Record", "Signature", "Registry"],
  coreInfraChain: ["RuntimeNode", "Service", "DataSource", "EventTopic", "EvidenceRecord"],
  knowledgeChain: ["KnowledgeNode", "KnowledgeEdge", "Citation", "EvidenceRecord"],
  coreApiRoutes: ["/api/core/health", "/api/runtime/registry", "/api/events", "/api/search", "/api/evidence"],
} as const;
