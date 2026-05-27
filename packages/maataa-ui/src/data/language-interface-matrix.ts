import type { AamJantaaMatrix } from "../types/aam-jantaa";
import { runtimeModules } from "./runtime-modules";

export const languageInterfaceMatrix: AamJantaaMatrix = {
  languages: [
    { code: "hi", label: "Hindi", nativeLabel: "हिंदी", status: "PREVIEW" },
    { code: "hr", label: "Haryanvi", nativeLabel: "हरियाणवी", status: "PREVIEW" },
    { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", status: "PREVIEW" },
  ],
  frames: [
    { id: "home", title: "Home Frame", status: "PREVIEW" },
    { id: "language-select", title: "Language Select", status: "PREVIEW" },
    { id: "aam-jantaa-dashboard", title: "Aam Jantaa Dashboard", status: "PREVIEW" },
    { id: "feature-entry-cards", title: "Feature Entry Cards", status: "PREVIEW" },
    { id: "runtime-health", title: "Runtime Health", status: "DEGRADED" },
    { id: "evidence-blocked-reason", title: "Evidence / Blocked Reason View", status: "BLOCKED" },
    { id: "rollback-offline-fallback", title: "Rollback / Offline Fallback View", status: "VERIFYING" },
  ],
  features: runtimeModules,
};
