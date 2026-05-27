import type { HonestStatusBadgeValue } from "./governance";
import type { RuntimeModule } from "./runtime";

export type AamJantaaLanguageCode = "hi" | "hr" | "pa";

export interface AamJantaaLanguageMode {
  code: AamJantaaLanguageCode;
  label: string;
  nativeLabel: string;
  status: HonestStatusBadgeValue;
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
  status: HonestStatusBadgeValue;
}

export interface AamJantaaFeature extends RuntimeModule {
  languageLabels: Record<AamJantaaLanguageCode, string>;
}

export interface AamJantaaMatrix {
  languages: AamJantaaLanguageMode[];
  frames: AamJantaaFrame[];
  features: AamJantaaFeature[];
}
