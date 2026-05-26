import type { CSSProperties, ReactNode } from "react";

export type ThemeFamily =
  | "AGE"
  | "ACCESSIBILITY"
  | "RUNTIME"
  | "AI"
  | "DEVICE"
  | "EMOTION"
  | "LANGUAGE"
  | "NETWORK"
  | "CHAKRA"
  | "OPERATOR"
  | "CINEMATIC"
  | "SCIENTIFIC"
  | "OBSERVATORY"
  | "GOVERNANCE";

export type RuntimeMode =
  | "LITE"
  | "STANDARD"
  | "OFFLINE"
  | "ACCESSIBILITY"
  | "OPERATOR"
  | "CINEMATIC"
  | "OBSERVATORY"
  | "SCIENTIFIC"
  | "HS_UNIVERSAL";

export type ObservatoryRoute =
  | "/runtime-observatory"
  | "/ephemeris-observatory"
  | "/universal-observatory"
  | "/theme-lab"
  | "/celestial-simulator"
  | "/vehicle-screen"
  | "/device-lab";

export type GovernanceState =
  | "RAW"
  | "NORMALIZED"
  | "VALIDATED_PREVIEW"
  | "REFERENCE_VALIDATED"
  | "SIGNED"
  | "SCIENTIFIC_CERTIFIED";

export type RuntimeHealthState = "nominal" | "degraded" | "recovery";

export type CanonicalRuntimeState =
  | "EXPERIMENTAL"
  | "STAGED"
  | "PREVIEW_VERIFIED"
  | "CONTROLLED_GO"
  | "CONTROLLED_NO_GO"
  | "BLOCKED"
  | "DEPRECATED";

export type RuntimeStat = {
  label: string;
  value: string | number;
  tone?: RuntimeHealthState;
};

export type RuntimeSurfaceProps = {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  stats?: RuntimeStat[];
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
};

export type ThemeTokenSet = {
  id: string;
  family: ThemeFamily;
  label: string;
  variables: Record<string, string>;
};

export type RuntimeSnapshot = {
  mode: RuntimeMode;
  health: RuntimeHealthState;
  governanceState: GovernanceState;
  route: ObservatoryRoute;
  stats: RuntimeStat[];
};
