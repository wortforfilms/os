import type { KbsClaim, KbsGraphEdge, KbsGraphNode, KbsGovernanceState, KbsSource } from "./types.ts";

export const kbsGovernanceState: KbsGovernanceState = {
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  blockers: [
    "hardware_attestation_missing",
    "rollback_drill_verification_missing",
    "operator_quorum_unverified",
    "signed_release_authority_unverified",
    "moderation_maturity_missing",
    "public_trust_layer_missing",
    "account_safety_maturity_missing"
  ]
};

export const kbsSources: KbsSource[] = [
  { id: "source-rigveda", title: "Vedas - Rigveda Samhita", type: "Sacred Text", author: "Various Rishis", trustLevel: "HIGH", status: "VERIFIED" },
  { id: "source-scripts-evolution", title: "Bharatiya Scripts Evolution", type: "Research Paper", author: "Dr. Sharma", trustLevel: "HIGH", status: "VERIFIED" },
  { id: "source-charaka", title: "Ayurveda - Charaka Samhita", type: "Ancient Text", author: "Agnivesha", trustLevel: "HIGH", status: "VERIFIED" },
  { id: "source-unsourced-date", title: "Unverified Historical Date", type: "Claim Note", trustLevel: "BLOCKED", status: "BLOCKED" }
];

export const kbsClaims: KbsClaim[] = [
  {
    id: "claim-brahmi-origin",
    text: "Brahmi script is one of the earliest scripts of India.",
    domain: "Lipi",
    status: "VERIFIED",
    citations: [{ id: "citation-brahmi-1", sourceId: "source-scripts-evolution", locator: "section 2" }],
    evidenceIds: ["evidence-brahmi-inscription"],
    confidence: 0.92,
    frozen: false
  },
  {
    id: "claim-rigveda-analysis",
    text: "Rigveda material has layered analysis requirements.",
    domain: "Culture",
    status: "PARTIAL",
    citations: [{ id: "citation-rigveda-1", sourceId: "source-rigveda", locator: "mandala index" }],
    evidenceIds: ["evidence-rigveda-source"],
    confidence: 0.72,
    frozen: false
  },
  {
    id: "claim-unsourced-date",
    text: "Unverified historical date.",
    domain: "Culture",
    status: "BLOCKED",
    citations: [],
    evidenceIds: [],
    confidence: 0,
    frozen: true,
    blockedReason: "No citation lineage or source hash is attached."
  }
];

export const kbsGraphNodes: KbsGraphNode[] = [
  { id: "domain-lipi", type: "DOMAIN", label: "Lipi" },
  { id: "source-scripts-evolution", type: "SOURCE", label: "Bharatiya Scripts Evolution" },
  { id: "claim-brahmi-origin", type: "CLAIM", label: "Brahmi script origin", status: "VERIFIED" },
  { id: "citation-brahmi-1", type: "CITATION", label: "Brahmi source citation" },
  { id: "evidence-brahmi-inscription", type: "EVIDENCE", label: "Brahmi inscription evidence" },
  { id: "script-brahmi", type: "SCRIPT", label: "Brahmi" },
  { id: "script-kharosthi", type: "SCRIPT", label: "Kharosthi" },
  { id: "script-siddham", type: "SCRIPT", label: "Siddham" }
];

export const kbsGraphEdges: KbsGraphEdge[] = [
  { id: "edge-claim-domain", from: "claim-brahmi-origin", to: "domain-lipi", type: "BELONGS_TO", confidence: 1 },
  { id: "edge-claim-citation", from: "claim-brahmi-origin", to: "citation-brahmi-1", type: "CITES", confidence: 0.92 },
  { id: "edge-citation-source", from: "citation-brahmi-1", to: "source-scripts-evolution", type: "DERIVES_FROM", confidence: 0.91 },
  { id: "edge-claim-evidence", from: "evidence-brahmi-inscription", to: "claim-brahmi-origin", type: "SUPPORTS", confidence: 0.88 },
  { id: "edge-brahmi-kharosthi", from: "script-kharosthi", to: "script-brahmi", type: "DERIVES_FROM", confidence: 0.66 },
  { id: "edge-siddham-brahmi", from: "script-siddham", to: "script-brahmi", type: "DERIVES_FROM", confidence: 0.78 }
];
