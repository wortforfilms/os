import type {
  CompletionRuntimeFrame,
  CriticalGapRecord,
  GenesisNode,
  LipiKnowledgeFrame,
  RadioPlaybackState,
} from "./types";

export const GENESIS_NODES: readonly GenesisNode[] = [
  { id: "Mandi", layer: "Commerce" },
  { id: "ALLB_Shop", layer: "Assets" },
  { id: "Vidhaan", layer: "Knowledge" },
  { id: "AAI", layer: "Intelligence" },
  { id: "KAA", layer: "Language" },
  { id: "CIC", layer: "Communication" },
  { id: "Krishi", layer: "Agriculture" },
  { id: "B2A", layer: "Commerce" },
] as const;

export const RADIO_VAIGYAANIQ_PLAYBACK: RadioPlaybackState = {
  trackId: "radio-vaigyaaniq-sacred-morning",
  title: "Sacred Morning",
  subtitle: "A Devotional Journey",
  durationSeconds: 46,
  elapsedSeconds: 45,
  isUnlocked: false,
  entitlementCostINR: 10,
  sseState: "CONNECTED",
} as const;

export const CRITICAL_GAP_MATRIX: readonly CriticalGapRecord[] = [
  { gapId: "astronomy-validation", label: "Astronomy Validation", status: "BLOCKED", completionPercentage: 0 },
  { gapId: "ephemeris-evidence", label: "Ephemeris Evidence", status: "BLOCKED", completionPercentage: 0 },
  { gapId: "de440-verification", label: "DE440 Verification", status: "BLOCKED", completionPercentage: 0 },
  { gapId: "gaia-validation", label: "Gaia Validation", status: "BLOCKED", completionPercentage: 0 },
  { gapId: "panchanga-accuracy", label: "Panchanga Accuracy", status: "PARTIAL", completionPercentage: 40 },
  { gapId: "transport-authority", label: "Transport Authority", status: "EARLY", completionPercentage: 20 },
  { gapId: "telemetry-provenance", label: "Telemetry Provenance", status: "PARTIAL", completionPercentage: 55 },
] as const;

export const COMPLETION_RUNTIME_FRAME: CompletionRuntimeFrame = {
  completion_runtime: {
    gates: {
      go_no_go_gates: true,
      operational_evidence: true,
      human_validation: true,
      topology_capture: true,
      replay_verification: true,
    },
    evidence_manifests: {
      deployment_evidence: "verified",
      rollback_proof: "signed",
      release_governance: "enforced",
      evidence_manifests: "canonical",
      signed_and_verified: true,
    },
    manifest_files: [
      "COMPLETION_STATUS_MATRIX.json",
      "CAPTURE_BOARD.md",
      "RUNTIME_OBSERVATORY.json",
      "RUNTIME_VOCABULARY.md",
    ],
  },
} as const;

export const LIPI_KNOWLEDGE_FRAME: LipiKnowledgeFrame = {
  lipi_knowledge_civilization: {
    supported_scripts: [
      { id: "Brahmi", native_string: "𑀩𑀲𑀮", variant: "Ancient" },
      { id: "Gurmukhi", native_string: "ਬਸਲ", variant: "Regional" },
      { id: "Sharda", native_string: "𑆧𑆲𑆳", variant: "Script Heritage" },
      { id: "Shahmukhi", native_string: "شاہ مکھی", variant: "Perso-Arabic" },
      { id: "Landa", native_string: "𑇚", variant: "Linguistic" },
    ],
    runtimes: {
      script_learning_games: "active",
      ai_transliteration: "restricted_governed",
      pronunciation_teams: "retroflex_forced",
      linguistic_knowledge_graph: "hydrated",
      manuscript_preservation: "staged",
      civilization_mapping: "nominal",
    },
    domains: ["lipi.vaigyaaniq.online", "scripts.vaigyaaniq.online"],
  },
} as const;
