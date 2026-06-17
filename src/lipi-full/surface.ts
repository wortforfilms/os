export const lipiFullRoutes = [
  "/lipi",
  "/lipi/explorer",
  "/lipi/scripts",
  "/lipi/numerals",
  "/lipi/zero-registry",
  "/lipi/unicode",
  "/lipi/crosswalks",
  "/lipi/kbs",
  "/lipi/evidence",
  "/lipi/federation",
  "/lipi/ingestion",
  "/lipi/runtime-status",
  "/lipi/governance",
  "/lipi/review",
  "/lipi/audit",
  "/lipi/export",
  "/lipi/release",
  "/lipi/api",
] as const;

export type LipiFullWorkspaceRoute = (typeof lipiFullRoutes)[number];

export type LipiFullWorkspaceId =
  | "home"
  | "explorer"
  | "scripts"
  | "numerals"
  | "zero-registry"
  | "unicode"
  | "crosswalks"
  | "kbs"
  | "evidence"
  | "federation"
  | "ingestion"
  | "runtime-status"
  | "governance"
  | "review"
  | "audit"
  | "export"
  | "release"
  | "api"
  | "script-detail";

export type LipiFullWorkspace = {
  id: Exclude<LipiFullWorkspaceId, "script-detail">;
  route: LipiFullWorkspaceRoute;
  label: string;
  title: string;
  summary: string;
  features: string[];
  views: string[];
};

export const lipiFullWorkspaces: LipiFullWorkspace[] = [
  {
    id: "home",
    route: "/lipi",
    label: "Home",
    title: "Lipi Knowledge System",
    summary: "Unicode-scale script intelligence shell over the PHKD-gated 426-row registry.",
    features: ["Surface Map", "Hero Metrics", "Gate State", "Quick Actions"],
    views: ["Map", "Metrics", "Readiness"],
  },
  {
    id: "explorer",
    route: "/lipi/explorer",
    label: "Explorer",
    title: "Explorer",
    summary: "Search, filters, sorting, saved-view placeholders, cross references, and evidence links.",
    features: ["Search", "Filters", "Sorting", "Saved Views", "Cross References", "Evidence Links"],
    views: ["Table", "Cards", "Timeline", "Graph", "Evidence"],
  },
  {
    id: "scripts",
    route: "/lipi/scripts",
    label: "Scripts",
    title: "Scripts",
    summary: "Registry rows grouped by Unicode status, registry class, and evidence posture.",
    features: ["Registry Rows", "Script Families", "Class Buckets", "Evidence Badges"],
    views: ["Table", "Cards", "Script Detail"],
  },
  {
    id: "numerals",
    route: "/lipi/numerals",
    label: "Numerals",
    title: "Numeral Explorer",
    summary: "Decimal digit inventories and zero glyph evidence from UCD-derived artifacts.",
    features: ["Unicode Digits", "Digit Registry", "Numeral Evolution", "Zero Links"],
    views: ["Numeral Evolution", "Unicode Digits", "Digit Registry", "Zero Registry"],
  },
  {
    id: "zero-registry",
    route: "/lipi/zero-registry",
    label: "Zero Registry",
    title: "Zero Registry",
    summary: "Every decimal script zero glyph remains source-backed and review-gated.",
    features: ["Zero Glyphs", "Code Points", "Evidence Sources", "Coverage"],
    views: ["Zero Glyphs", "UnicodeData", "Evidence"],
  },
  {
    id: "unicode",
    route: "/lipi/unicode",
    label: "Unicode",
    title: "Unicode Workspace",
    summary: "Unicode Script values, blocks, ranges, aliases, and version metadata.",
    features: ["Unicode Scripts", "Unicode Blocks", "Unicode Ranges", "Version History"],
    views: ["Scripts", "Blocks", "Ranges", "Version History"],
  },
  {
    id: "crosswalks",
    route: "/lipi/crosswalks",
    label: "Crosswalks",
    title: "Crosswalk Explorer",
    summary: "Unicode, ISO 15924, CLDR, ICU, and dry-run comparison surfaces.",
    features: ["Unicode Crosswalk", "ISO 15924", "CLDR", "ICU", "Diff Preview"],
    views: ["Unicode", "ISO", "CLDR", "ICU", "Diffs"],
  },
  {
    id: "kbs",
    route: "/lipi/kbs",
    label: "KBS Graph",
    title: "KBS Graph",
    summary: "Evidence graph neighborhood over scripts, Unicode values, ranges, blocks, numerals, and sources.",
    features: ["Script Nodes", "Unicode Edges", "Range Edges", "Evidence Edges"],
    views: ["Graph", "Neighborhood", "Blocked Fields"],
  },
  {
    id: "evidence",
    route: "/lipi/evidence",
    label: "Evidence",
    title: "Evidence Center",
    summary: "Source lineage, provenance, audit, conflicts, and trust matrix panels.",
    features: ["Lineage", "Provenance", "Audit", "Conflicts", "Trust Matrix"],
    views: ["Sources", "Lineage", "Provenance", "Audit", "Conflicts"],
  },
  {
    id: "federation",
    route: "/lipi/federation",
    label: "Federation",
    title: "Federation Layer",
    summary: "External authority registry and provenance chains without new script claims.",
    features: ["Source Registry", "Evidence Lineage", "Source Conflicts", "Provenance Chains"],
    views: ["Sources", "Lineage", "Conflicts", "Chains"],
  },
  {
    id: "ingestion",
    route: "/lipi/ingestion",
    label: "Ingestion",
    title: "Ingestion Workspace",
    summary: "Contracts and dry-run ingestion previews for ISO, CLDR, ICU, HarfBuzz, and OpenType.",
    features: ["Contracts", "Dry Run", "ISO", "CLDR", "ICU", "HB/OT", "Diff Preview", "Blockers"],
    views: ["Contracts", "Dry Run", "Diffs", "Blockers"],
  },
  {
    id: "runtime-status",
    route: "/lipi/runtime-status",
    label: "Runtime Status",
    title: "Runtime Status",
    summary: "Controlled preview runtime is active for read-only exploration while row enablement and production GO remain blocked.",
    features: ["Controlled Preview Runtime Active", "Read Only", "Row Mutation Disabled", "Enrichment Auto-Apply Disabled", "Production GO Blocked"],
    views: ["Runtime", "Policy", "Blockers", "Evidence"],
  },
  {
    id: "governance",
    route: "/lipi/governance",
    label: "Governance",
    title: "Governance Workspace",
    summary: "Authority audit, runtime gate, production gate, and approval-chain state.",
    features: ["Authority Audit", "Runtime Gate", "Production Gate", "Approval Chain"],
    views: ["Authority", "Runtime", "Production", "Approvals"],
  },
  {
    id: "review",
    route: "/lipi/review",
    label: "Review",
    title: "Review Workspace",
    summary: "Operator runbook, external review package, decision log, and production GO refusal.",
    features: ["Operator Runbook", "External Review", "Decision Log", "Production GO"],
    views: ["Runbook", "External Review", "Decisions", "Production GO"],
  },
  {
    id: "audit",
    route: "/lipi/audit",
    label: "Audit",
    title: "Audit Workspace",
    summary: "Audit report, provenance report, diff report, and conflict report surfaces.",
    features: ["Audit Report", "Provenance Report", "Diff Report", "Conflict Report"],
    views: ["Audit", "Provenance", "Diffs", "Conflicts"],
  },
  {
    id: "export",
    route: "/lipi/export",
    label: "Export",
    title: "Export Center",
    summary: "Reproducible JSON, CSV, SQL, evidence bundle, review package, and RC bundle outputs.",
    features: ["JSON", "CSV", "SQL", "Evidence Bundle", "Review Package", "RC Bundle"],
    views: ["Artifacts", "Hashes", "Bundles"],
  },
  {
    id: "release",
    route: "/lipi/release",
    label: "Release",
    title: "Release Center",
    summary: "Release-candidate evidence remains blocked until review and human approval complete.",
    features: ["RC Bundle", "Runtime Gate", "Human Approval", "Production GO"],
    views: ["Bundle", "Gate", "Blockers"],
  },
  {
    id: "api",
    route: "/lipi/api",
    label: "API",
    title: "API",
    summary: "Local API contracts for registry, graph, evidence, ingestion, review, and governance surfaces.",
    features: ["Contracts", "Handlers", "Schemas", "Source Policies"],
    views: ["Contracts", "Schemas", "Policies"],
  },
];

export const lipiFullRouteSet = new Set<string>(lipiFullRoutes);

export function isLipiFullRoute(path: string): boolean {
  return lipiFullRouteSet.has(path) || path.startsWith("/lipi/script/");
}

export function lipiFullWorkspaceFromRoute(path: string): LipiFullWorkspaceId {
  if (path.startsWith("/lipi/script/")) return "script-detail";
  return lipiFullWorkspaces.find((workspace) => workspace.route === path)?.id ?? "home";
}
