export const RUNTIME_STATE_AUTHORITY = Object.freeze({
  EXPERIMENTAL: {
    label: "EXPERIMENTAL",
    description: "Exploratory code or design surface without release evidence.",
  },
  STAGED: {
    label: "STAGED",
    description: "Scaffold or adapter exists, but production connection is incomplete.",
  },
  PREVIEW_VERIFIED: {
    label: "PREVIEW_VERIFIED",
    description: "Implemented preview with local build or verification evidence.",
  },
  CONTROLLED_GO: {
    label: "CONTROLLED_GO",
    description: "Allowed for a bounded local workflow with known constraints.",
  },
  CONTROLLED_NO_GO: {
    label: "CONTROLLED_NO_GO",
    description: "Deliberately blocked until named evidence is produced.",
  },
  BLOCKED: {
    label: "BLOCKED",
    description: "Cannot ship or claim readiness because a required gate is absent.",
  },
  DEPRECATED: {
    label: "DEPRECATED",
    description: "Retained for compatibility only; not a supported product surface.",
  },
} as const);

export type CanonicalRuntimeState = keyof typeof RUNTIME_STATE_AUTHORITY;

export function isRuntimeState(value: string): value is CanonicalRuntimeState {
  return Object.prototype.hasOwnProperty.call(RUNTIME_STATE_AUTHORITY, value);
}
