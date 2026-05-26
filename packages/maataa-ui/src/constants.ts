import type { GovernanceState, ObservatoryRoute, RuntimeMode, ThemeFamily } from "./types";

export const THEME_FAMILIES: readonly ThemeFamily[] = [
  "AGE",
  "ACCESSIBILITY",
  "RUNTIME",
  "AI",
  "DEVICE",
  "EMOTION",
  "LANGUAGE",
  "NETWORK",
  "CHAKRA",
  "OPERATOR",
  "CINEMATIC",
  "SCIENTIFIC",
  "OBSERVATORY",
  "GOVERNANCE",
];

export const RUNTIME_MODES: readonly RuntimeMode[] = [
  "LITE",
  "STANDARD",
  "OFFLINE",
  "ACCESSIBILITY",
  "OPERATOR",
  "CINEMATIC",
  "OBSERVATORY",
  "SCIENTIFIC",
  "HS_UNIVERSAL",
];

export const OBSERVATORY_ROUTES: readonly ObservatoryRoute[] = [
  "/runtime-observatory",
  "/ephemeris-observatory",
  "/universal-observatory",
  "/theme-lab",
  "/celestial-simulator",
  "/vehicle-screen",
  "/device-lab",
];

export const GOVERNANCE_STATES: readonly GovernanceState[] = [
  "RAW",
  "NORMALIZED",
  "VALIDATED_PREVIEW",
  "REFERENCE_VALIDATED",
  "SIGNED",
  "SCIENTIFIC_CERTIFIED",
];

export const PHKD_RUNTIME_RULE =
  "UI Runtime is not Scientific Certification. Certification requires evidence gates.";

export const CANONICAL_RUNTIME_STATES = [
  "EXPERIMENTAL",
  "STAGED",
  "PREVIEW_VERIFIED",
  "CONTROLLED_GO",
  "CONTROLLED_NO_GO",
  "BLOCKED",
  "DEPRECATED",
] as const;
