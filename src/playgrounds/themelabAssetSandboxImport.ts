export type ImportedClaimState = "SOURCE_CLAIM_ONLY" | "BLOCKED" | "REVIEW_ONLY";

export type ImportedAssetClaim = {
  id: string;
  label: string;
  value: string;
  state: ImportedClaimState;
  blocker: string;
};

export type ImportedAssetReviewRoutePath =
  | "/themelab/asset-sandbox/overview"
  | "/themelab/asset-sandbox/library"
  | "/themelab/asset-sandbox/preview"
  | "/themelab/asset-sandbox/icons"
  | "/themelab/asset-sandbox/heroes"
  | "/themelab/asset-sandbox/cards"
  | "/themelab/asset-sandbox/avatars"
  | "/themelab/asset-sandbox/metadata"
  | "/themelab/asset-sandbox/download"
  | "/themelab/asset-sandbox/evidence";

export type ImportedAssetReviewRoute = {
  path: ImportedAssetReviewRoutePath;
  title: string;
  anchor: string;
  summary: string;
  sourceSection: string;
  reviewState: "PREVIEW_VERIFIED";
  blockers: Array<{ id: string; label: string; blocker: string }>;
};

export const themeLabAssetSandboxImport = {
  schema: "maataa.themelab.asset-sandbox.import.v1",
  sourcePath: "release/imports/themelab_asset_sandbox.html",
  sourceFileName: "themelab_asset_sandbox.html",
  sourceTitle: "ThemeLab Asset Sandbox",
  importedAt: "2026-06-15",
  finalStatus: "CONTROLLED_NO_GO",
  productionStatus: "PRODUCTION_READY_NO",
  productionReady: false,
  productionDatabase: false,
  realPayments: false,
  purchasedAccess: false,
  runtimePromotion: false,
  claimMode: "IMPORTED_SOURCE_CLAIMS_NOT_LIVE_METRICS",
  sourceClaims: [
    {
      id: "total-assets",
      label: "Total assets",
      value: "666",
      state: "SOURCE_CLAIM_ONLY",
      blocker: "Imported HTML claim only; no generated asset registry count is attached.",
    },
    {
      id: "icon-files",
      label: "Icon files",
      value: "273",
      state: "SOURCE_CLAIM_ONLY",
      blocker: "Imported HTML claim only; icon inventory has not been reconciled to repository files.",
    },
    {
      id: "heroes",
      label: "Hero assets",
      value: "105",
      state: "SOURCE_CLAIM_ONLY",
      blocker: "Imported HTML claim only; hero file manifest is not present.",
    },
    {
      id: "illustrations",
      label: "Illustrations",
      value: "105",
      state: "SOURCE_CLAIM_ONLY",
      blocker: "Imported HTML claim only; illustration registry is not present.",
    },
    {
      id: "avatars",
      label: "Avatars",
      value: "30",
      state: "SOURCE_CLAIM_ONLY",
      blocker: "Imported HTML claim only; avatar manifest is not present.",
    },
  ] satisfies ImportedAssetClaim[],
  families: ["Vaigyaaniq", "TLP", "Radio", "Lipi", "Samwat", "Investor"],
  sandboxBoundaries: [
    { label: "Real payments", state: "BLOCKED", evidence: "Imported source declares no real payments." },
    { label: "Purchased access", state: "BLOCKED", evidence: "Imported source declares no purchased access." },
    { label: "Download mode", state: "REVIEW_ONLY", evidence: "Downloaded HTML exposes simulate/download controls only." },
    { label: "Production DB", state: "BLOCKED", evidence: "No production database is used by this route." },
  ],
} as const;

export const themeLabAssetReviewRoutes: readonly ImportedAssetReviewRoute[] = [
  {
    path: "/themelab/asset-sandbox/overview",
    title: "Asset Overview Review",
    anchor: "#overview",
    sourceSection: "overview",
    summary: "Reviews the imported overview hero, asset-count claims, and PHKD no-go boundary.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "source-counts", label: "Asset Counts", blocker: "The 666 total asset claim is imported source text only until reconciled to a generated registry." },
    ],
  },
  {
    path: "/themelab/asset-sandbox/library",
    title: "Asset Library Review",
    anchor: "#library",
    sourceSection: "library",
    summary: "Reviews imported family bins for Vaigyaaniq, TLP, Radio, Lipi, Samwat, and Investor assets.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "registry", label: "Asset Registry", blocker: "Family bins are imported review metadata; no repository asset manifest verifies per-family counts." },
    ],
  },
  {
    path: "/themelab/asset-sandbox/preview",
    title: "Live Preview Review",
    anchor: "#preview",
    sourceSection: "preview",
    summary: "Reviews the imported light/dark/mobile/desktop preview controls as local UI only.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "live-rendering", label: "Live Rendering", blocker: "Preview controls do not load a production asset renderer or route context service." },
    ],
  },
  {
    path: "/themelab/asset-sandbox/icons",
    title: "Icon Review",
    anchor: "#icons",
    sourceSection: "icons",
    summary: "Reviews imported icon cards and their local source names without asserting file inventory completeness.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "icon-count", label: "Icon Inventory", blocker: "The 273 icon-file claim is not backed by a generated repository icon manifest." },
    ],
  },
  {
    path: "/themelab/asset-sandbox/heroes",
    title: "Hero Asset Review",
    anchor: "#heroes",
    sourceSection: "heroes",
    summary: "Reviews imported hero rows and variant counts as source claims.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "hero-manifest", label: "Hero Manifest", blocker: "Hero files and variants are not reconciled to a versioned manifest." },
    ],
  },
  {
    path: "/themelab/asset-sandbox/cards",
    title: "Card Asset Review",
    anchor: "#cards",
    sourceSection: "cards",
    summary: "Reviews imported card and thumbnail sandbox entries as local review metadata.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "thumbnail-registry", label: "Thumbnail Registry", blocker: "Card and thumbnail entries are not connected to a generated asset registry." },
    ],
  },
  {
    path: "/themelab/asset-sandbox/avatars",
    title: "Avatar Review",
    anchor: "#avatars",
    sourceSection: "avatars",
    summary: "Reviews imported avatar categories without claiming generated avatar coverage.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "avatar-manifest", label: "Avatar Manifest", blocker: "The 30 avatar claim is imported source text only until file-backed." },
    ],
  },
  {
    path: "/themelab/asset-sandbox/metadata",
    title: "Asset Metadata Review",
    anchor: "#metadata",
    sourceSection: "metadata",
    summary: "Reviews imported title, description, alt text, registry path, and color token declarations.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "metadata-validation", label: "Metadata Validation", blocker: "No automated asset metadata validator is attached yet." },
    ],
  },
  {
    path: "/themelab/asset-sandbox/download",
    title: "Download Review",
    anchor: "#download",
    sourceSection: "download",
    summary: "Reviews imported download controls while keeping purchased access and real payments blocked.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "payments", label: "Real Payments", blocker: "No payment provider or entitlement grant is connected to this sandbox." },
      { id: "download", label: "Download Grant", blocker: "Download controls are simulated review UI and do not produce purchased access." },
    ],
  },
  {
    path: "/themelab/asset-sandbox/evidence",
    title: "Asset Evidence Review",
    anchor: "#evidence",
    sourceSection: "evidence",
    summary: "Reviews imported evidence tiles while preserving the global controlled no-go state.",
    reviewState: "PREVIEW_VERIFIED",
    blockers: [
      { id: "playwright", label: "Visual Evidence", blocker: "Imported evidence labels require regenerated MAATAA-side screenshots for each review route." },
      { id: "registry-proof", label: "Registry Proof", blocker: "Asset registry and SVG metadata proofs are not independently generated from repository files." },
    ],
  },
] as const;
