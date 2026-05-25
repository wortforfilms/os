export type MaataaSubsystemId =
  | "GENESIS_AI"
  | "ORCHESTRATION_LAYER"
  | "MONOREPO_SOVEREIGNTY"
  | "MAATAA_UI"
  | "COMPLETION_RUNTIME"
  | "RUNTIME_OBSERVATORY"
  | "OFFLINE_SOVEREIGNTY"
  | "AYODHYA_STUDIO"
  | "RADIO_RUNTIME"
  | "COMMUNICATION_CORE"
  | "LIPI_CIVILIZATION"
  | "CHAKRA_CONSCIOUSNESS"
  | "BRAHMINI_CHAIN"
  | "TLP_EVOLUTION"
  | "SCIENTIFIC_GOVERNANCE";

export type GapRemediationStatus = "BLOCKED" | "PARTIAL" | "EARLY" | "NOMINAL";

export type GenesisNodeId = "Mandi" | "ALLB_Shop" | "Vidhaan" | "AAI" | "KAA" | "CIC" | "Krishi" | "B2A";

export type GenesisLayer =
  | "Commerce"
  | "Intelligence"
  | "Language"
  | "Knowledge"
  | "Communication"
  | "Agriculture"
  | "Assets";

export interface GenesisNode {
  id: GenesisNodeId;
  layer: GenesisLayer;
}

export interface RadioPlaybackState {
  trackId: string;
  title: string;
  subtitle: string;
  durationSeconds: number;
  elapsedSeconds: number;
  isUnlocked: boolean;
  entitlementCostINR: number;
  sseState: "CONNECTED" | "DISCONNECTED" | "RETRYING";
}

export interface CriticalGapRecord {
  gapId: string;
  label: string;
  status: GapRemediationStatus;
  completionPercentage: number;
}

export interface CompletionRuntimeFrame {
  completion_runtime: {
    gates: {
      go_no_go_gates: boolean;
      operational_evidence: boolean;
      human_validation: boolean;
      topology_capture: boolean;
      replay_verification: boolean;
    };
    evidence_manifests: {
      deployment_evidence: "verified" | "blocked";
      rollback_proof: "signed" | "missing";
      release_governance: "enforced" | "blocked";
      evidence_manifests: "canonical" | "draft";
      signed_and_verified: boolean;
    };
    manifest_files: readonly string[];
  };
}

export interface LipiScriptDescriptor {
  id: "Brahmi" | "Gurmukhi" | "Sharda" | "Shahmukhi" | "Landa";
  native_string: string;
  variant: "Ancient" | "Regional" | "Script Heritage" | "Perso-Arabic" | "Linguistic";
}

export interface LipiKnowledgeFrame {
  lipi_knowledge_civilization: {
    supported_scripts: readonly LipiScriptDescriptor[];
    runtimes: {
      script_learning_games: "active" | "staged";
      ai_transliteration: "restricted_governed" | "blocked";
      pronunciation_teams: "retroflex_forced" | "staged";
      linguistic_knowledge_graph: "hydrated" | "empty";
      manuscript_preservation: "staged" | "active";
      civilization_mapping: "nominal" | "blocked";
    };
    domains: readonly string[];
  };
}

export interface DashboardWidgetState {
  label: string;
  status: string;
  tone?: GapRemediationStatus;
}
