import languageInterfaceMatrix from "../../data/language-interface-matrix.json";

export const AAM_JANTAA_ALLOWED_BADGES = [
  "READY",
  "PREVIEW",
  "BLOCKED",
  "OFFLINE",
  "VERIFYING",
  "DEGRADED",
] as const;

export type AamJantaaBadge = (typeof AAM_JANTAA_ALLOWED_BADGES)[number];
export type AamJantaaLanguageId = "hindi" | "haryanvi" | "punjabi";
export type AamJantaaFinalStatus = "GOVERNED_PRODUCTION_NO_GO";

export interface AamJantaaLanguage {
  id: AamJantaaLanguageId;
  label: string;
  nativeLabel: string;
  direction: "ltr";
  status: AamJantaaBadge;
  readinessReason: string;
}

export interface AamJantaaFrame {
  id:
    | "home"
    | "language-select"
    | "aam-jantaa-dashboard"
    | "feature-entry-cards"
    | "runtime-health"
    | "evidence-blocked-reason"
    | "rollback-offline-fallback";
  title: string;
  order: number;
  status: AamJantaaBadge;
  description: string;
}

export interface AamJantaaFeature {
  id:
    | "digital-gurukul"
    | "radio-vaigyaaniq"
    | "local-search"
    | "runtime-health"
    | "lipi-learning"
    | "community-broadcast";
  title: string;
  languageLabels: Record<AamJantaaLanguageId, string>;
  description: string;
  route: string;
  statusBadge: AamJantaaBadge;
  readinessReason: string;
  offlineAvailability: boolean;
  blockedReason: string | null;
}

export interface AamJantaaInterfaceMatrix {
  schema: string;
  phase: "0.5";
  status: AamJantaaBadge;
  productionReady: false;
  phkdVerdict: "BLOCKED";
  finalStatus: AamJantaaFinalStatus;
  allowedBadges: AamJantaaBadge[];
  languages: AamJantaaLanguage[];
  frames: AamJantaaFrame[];
  features: AamJantaaFeature[];
}

export interface AamJantaaUserFlowStep {
  frameId: AamJantaaFrame["id"];
  title: string;
  status: AamJantaaBadge;
  nextFrameId: AamJantaaFrame["id"] | null;
}

export interface AamJantaaDashboardView {
  language: AamJantaaLanguage;
  flow: AamJantaaUserFlowStep[];
  features: AamJantaaFeature[];
  governance: {
    phkdVerdict: "BLOCKED";
    productionReady: false;
    finalStatus: AamJantaaFinalStatus;
    activeBlockers: string[];
  };
}

export const aamJantaaInterfaceMatrix = languageInterfaceMatrix as AamJantaaInterfaceMatrix;

export const AAM_JANTAA_FLOW: AamJantaaUserFlowStep[] = aamJantaaInterfaceMatrix.frames
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((frame, index, frames) => ({
    frameId: frame.id,
    title: frame.title,
    status: frame.status,
    nextFrameId: frames[index + 1]?.id ?? null,
  }));

export function buildAamJantaaDashboard(languageId: AamJantaaLanguageId): AamJantaaDashboardView {
  const language = aamJantaaInterfaceMatrix.languages.find((entry) => entry.id === languageId);
  if (!language) {
    throw new Error(`Unsupported Aam Jantaa language: ${languageId}`);
  }

  return {
    language,
    flow: AAM_JANTAA_FLOW,
    features: aamJantaaInterfaceMatrix.features,
    governance: {
      phkdVerdict: "BLOCKED",
      productionReady: false,
      finalStatus: "GOVERNED_PRODUCTION_NO_GO",
      activeBlockers: [
        "hardware-root attestation is not CAPTURED",
        "release signer verification is not VERIFIED",
        "operator quorum is not VERIFIED",
        "rollback drill evidence is not captured",
      ],
    },
  };
}

export function getFeatureLabel(feature: AamJantaaFeature, languageId: AamJantaaLanguageId): string {
  return feature.languageLabels[languageId];
}

export function isOfflineCapable(feature: AamJantaaFeature): boolean {
  return feature.offlineAvailability === true;
}
