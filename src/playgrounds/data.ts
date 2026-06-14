export type PlaygroundRouteId =
  | "/maataa-ui/playground"
  | "/maataa-ui/playground/components"
  | "/maataa-ui/playground/themes"
  | "/maataa-ui/playground/tokens"
  | "/maataa-ui/playground/layouts"
  | "/themelab/theme-sandbox"
  | "/themelab/asset-sandbox"
  | "/themelab/sandboxes";

export type PlaygroundStatus = "PREVIEW_VERIFIED" | "CONTROLLED_NO_GO" | "BLOCKED" | "UNKNOWN";

export type PlaygroundSection = {
  id: string;
  label: string;
  status: PlaygroundStatus;
  evidence: string;
  blocker?: string;
};

export type PlaygroundRoute = {
  path: PlaygroundRouteId;
  title: string;
  family: "Maataa UI" | "ThemeLab";
  summary: string;
  status: PlaygroundStatus;
  productionReady: false;
  runtimePromotion: false;
  paymentMode: "NONE";
  dataMode: "LOCAL_STATIC_REVIEW";
  evidence: string;
  sections: PlaygroundSection[];
};

export const PLAYGROUND_FINAL_STATUS = "CONTROLLED_NO_GO" as const;
export const PLAYGROUND_PRODUCTION_STATUS = "PRODUCTION_READY_NO" as const;

export const playgroundRoutes: PlaygroundRoute[] = [
  {
    path: "/maataa-ui/playground",
    title: "Maataa UI Playground",
    family: "Maataa UI",
    summary: "Index of PHKD-safe component, theme, token, and layout review surfaces.",
    status: "PREVIEW_VERIFIED",
    productionReady: false,
    runtimePromotion: false,
    paymentMode: "NONE",
    dataMode: "LOCAL_STATIC_REVIEW",
    evidence: "release/evidence/maataa-ui-playground/report.json",
    sections: [
      { id: "components", label: "Component Review", status: "PREVIEW_VERIFIED", evidence: "/maataa-ui/playground/components" },
      { id: "themes", label: "Theme Review", status: "PREVIEW_VERIFIED", evidence: "/maataa-ui/playground/themes" },
      { id: "tokens", label: "Token Review", status: "PREVIEW_VERIFIED", evidence: "/maataa-ui/playground/tokens" },
      { id: "layouts", label: "Layout Review", status: "PREVIEW_VERIFIED", evidence: "/maataa-ui/playground/layouts" },
    ],
  },
  {
    path: "/maataa-ui/playground/components",
    title: "Component Review",
    family: "Maataa UI",
    summary: "Review cards for exported UI primitives, honest badges, panels, and blocked states.",
    status: "PREVIEW_VERIFIED",
    productionReady: false,
    runtimePromotion: false,
    paymentMode: "NONE",
    dataMode: "LOCAL_STATIC_REVIEW",
    evidence: "release/evidence/maataa-ui-package-manifest.json",
    sections: [
      { id: "badges", label: "HonestStatusBadge", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/components/HonestStatusBadge.tsx" },
      { id: "evidence", label: "EvidencePanel", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/components/EvidencePanel.tsx" },
      { id: "blocked", label: "BlockedReasonView", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/components/BlockedReasonView.tsx" },
      { id: "payments", label: "Payment Widgets", status: "BLOCKED", evidence: "not present", blocker: "No real payments or checkout runtime is wired for this playground." },
    ],
  },
  {
    path: "/maataa-ui/playground/themes",
    title: "Theme Review",
    family: "Maataa UI",
    summary: "Theme registry review for accessibility, device, language, operator, and runtime themes.",
    status: "PREVIEW_VERIFIED",
    productionReady: false,
    runtimePromotion: false,
    paymentMode: "NONE",
    dataMode: "LOCAL_STATIC_REVIEW",
    evidence: "packages/maataa-ui/src/themes/index.ts",
    sections: [
      { id: "accessibility", label: "Accessibility Themes", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/themes/accessibility-themes.ts" },
      { id: "language", label: "Language Themes", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/themes/language-themes.ts" },
      { id: "operator", label: "Operator Themes", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/themes/operator-themes.ts" },
      { id: "promotion", label: "Runtime Promotion", status: "BLOCKED", evidence: "governed production gate", blocker: "Theme selection is review-only and cannot promote runtime state." },
    ],
  },
  {
    path: "/maataa-ui/playground/tokens",
    title: "Token Review",
    family: "Maataa UI",
    summary: "Design-token review for color, spacing, typography, motion, and status semantics.",
    status: "PREVIEW_VERIFIED",
    productionReady: false,
    runtimePromotion: false,
    paymentMode: "NONE",
    dataMode: "LOCAL_STATIC_REVIEW",
    evidence: "packages/maataa-ui/src/themes/css-variables.ts",
    sections: [
      { id: "color", label: "Color Tokens", status: "PREVIEW_VERIFIED", evidence: "CSS variable registry" },
      { id: "status", label: "Status Tokens", status: "PREVIEW_VERIFIED", evidence: "honest badge palette" },
      { id: "typography", label: "Typography Tokens", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/typography" },
      { id: "live-token-sync", label: "Live Token Sync", status: "UNKNOWN", evidence: "no runtime source", blocker: "No production design-token telemetry source is connected." },
    ],
  },
  {
    path: "/maataa-ui/playground/layouts",
    title: "Layout Review",
    family: "Maataa UI",
    summary: "Desktop, dashboard, observatory, runtime shell, and mobile layout review grid.",
    status: "PREVIEW_VERIFIED",
    productionReady: false,
    runtimePromotion: false,
    paymentMode: "NONE",
    dataMode: "LOCAL_STATIC_REVIEW",
    evidence: "packages/maataa-ui/src/layouts/index.ts",
    sections: [
      { id: "dashboard", label: "DashboardLayout", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/layouts/DashboardLayout.tsx" },
      { id: "runtime", label: "RuntimePageShell", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/layouts/RuntimePageShell.tsx" },
      { id: "observatory", label: "ObservatoryLayout", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/layouts/ObservatoryLayout.tsx" },
      { id: "mobile-runtime", label: "Mobile Runtime", status: "PREVIEW_VERIFIED", evidence: "packages/maataa-ui/src/mobile" },
    ],
  },
  {
    path: "/themelab/theme-sandbox",
    title: "ThemeLab Theme Sandbox",
    family: "ThemeLab",
    summary: "PHKD-safe sandbox for comparing local theme variants without publishing them.",
    status: "PREVIEW_VERIFIED",
    productionReady: false,
    runtimePromotion: false,
    paymentMode: "NONE",
    dataMode: "LOCAL_STATIC_REVIEW",
    evidence: "docs/theme-lab-runtime.md",
    sections: [
      { id: "variants", label: "Theme Variants", status: "PREVIEW_VERIFIED", evidence: "local static swatches" },
      { id: "contrast", label: "Contrast Checks", status: "UNKNOWN", evidence: "visual review only", blocker: "No automated WCAG contrast measurement is attached yet." },
      { id: "publish", label: "Publish Theme", status: "BLOCKED", evidence: "no runtime promotion", blocker: "Publishing is disabled in this local sandbox." },
    ],
  },
  {
    path: "/themelab/asset-sandbox",
    title: "ThemeLab Asset Sandbox",
    family: "ThemeLab",
    summary: "Asset review bins for local icons, media, and evidence thumbnails without CDN claims.",
    status: "PREVIEW_VERIFIED",
    productionReady: false,
    runtimePromotion: false,
    paymentMode: "NONE",
    dataMode: "LOCAL_STATIC_REVIEW",
    evidence: "assets/README.md",
    sections: [
      { id: "icons", label: "Icon Assets", status: "PREVIEW_VERIFIED", evidence: "local repository assets" },
      { id: "screens", label: "Evidence Screens", status: "PREVIEW_VERIFIED", evidence: "release/evidence/maataa-ui-playground/screenshots" },
      { id: "cdn", label: "CDN Delivery", status: "BLOCKED", evidence: "none", blocker: "No CDN node, live delivery, or download count is asserted." },
    ],
  },
  {
    path: "/themelab/sandboxes",
    title: "ThemeLab Sandboxes",
    family: "ThemeLab",
    summary: "Index of theme and asset sandboxes with blocked production controls visible.",
    status: "PREVIEW_VERIFIED",
    productionReady: false,
    runtimePromotion: false,
    paymentMode: "NONE",
    dataMode: "LOCAL_STATIC_REVIEW",
    evidence: "release/evidence/maataa-ui-playground/report.json",
    sections: [
      { id: "theme", label: "Theme Sandbox", status: "PREVIEW_VERIFIED", evidence: "/themelab/theme-sandbox" },
      { id: "asset", label: "Asset Sandbox", status: "PREVIEW_VERIFIED", evidence: "/themelab/asset-sandbox" },
      { id: "payments", label: "Paid Theme Sales", status: "BLOCKED", evidence: "none", blocker: "No real payments are available in ThemeLab review surfaces." },
    ],
  },
];

export const implementedPlaygroundRoutes = new Set<PlaygroundRouteId>(playgroundRoutes.map((route) => route.path));

export function getPlaygroundRoute(path: string): PlaygroundRoute | undefined {
  return playgroundRoutes.find((route) => route.path === path);
}
