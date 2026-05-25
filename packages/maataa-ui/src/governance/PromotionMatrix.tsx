import { RuntimeRecovery } from "../core/RuntimeRecovery";
import { RuntimeSurface } from "../components/status/RuntimeSurface";
import type { GovernanceState, RuntimeStat } from "../types";

export const VERIFY_REPRODUCIBLE = 0x01;
export const VERIFY_STRUCTURAL_TOLERANCE = 0x02;
export const VERIFY_MANIFEST_SIGNATURE = 0x04;
export const VERIFY_CERTIFICATION_CLEARANCE = 0x08;
export const VERIFY_GAP_REMEDIATION = 0x10;
export const AI_BATCH_CERTIFICATION_CLEARANCE = 0x08;
export const VERIFY_REQUIRED_MASK =
  VERIFY_REPRODUCIBLE | VERIFY_STRUCTURAL_TOLERANCE | VERIFY_MANIFEST_SIGNATURE | VERIFY_GAP_REMEDIATION;

export type PromotionProof = {
  verificationStatus: number;
  aiBatchStatus: number;
  logs?: readonly string[];
};

export type PromotionResolution = {
  governanceState: GovernanceState;
  certified: boolean;
  missing: readonly string[];
  stats: RuntimeStat[];
};

const criteria = [
  ["Mathematical Reproducibility", VERIFY_REPRODUCIBLE],
  ["Structural Tolerance", VERIFY_STRUCTURAL_TOLERANCE],
  ["Temporal HST Signature", VERIFY_MANIFEST_SIGNATURE],
  ["Gap State Remediation", VERIFY_GAP_REMEDIATION],
] as const;

export function resolvePromotion(proof: PromotionProof): PromotionResolution {
  const missing = criteria
    .filter(([, bit]) => (proof.verificationStatus & bit) !== bit)
    .map(([label]) => label);
  const aiBatchCertified = (proof.aiBatchStatus & AI_BATCH_CERTIFICATION_CLEARANCE) === AI_BATCH_CERTIFICATION_CLEARANCE;
  const certified =
    missing.length === 0 &&
    (proof.verificationStatus & VERIFY_CERTIFICATION_CLEARANCE) === VERIFY_CERTIFICATION_CLEARANCE &&
    aiBatchCertified;
  const resolvedMissing = aiBatchCertified ? missing : [...missing, "AI Batch Certification Bit"];

  return {
    governanceState: certified ? "SCIENTIFIC_CERTIFIED" : "SIGNED",
    certified,
    missing: resolvedMissing,
    stats: [
      { label: "Governance", value: certified ? "SCIENTIFIC_CERTIFIED" : "BLOCKED", tone: certified ? "nominal" : "recovery" },
      { label: "Verification", value: `0x${proof.verificationStatus.toString(16).padStart(2, "0")}`, tone: certified ? "nominal" : "recovery" },
      { label: "MOSF", value: `0x${proof.aiBatchStatus.toString(16).padStart(8, "0")}`, tone: certified ? "nominal" : "degraded" },
    ],
  };
}

export function PromotionMatrix({ proof }: { proof: PromotionProof }) {
  const resolution = resolvePromotion(proof);

  if (!resolution.certified) {
    return <RuntimeRecovery reason={`Promotion blocked: ${resolution.missing.join(", ") || "certification bit missing"}`} />;
  }

  return (
    <RuntimeSurface title="Promotion Matrix" subtitle="Scientific certification unlocked by native verification" stats={resolution.stats}>
      <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
        {criteria.map(([label, bit]) => (
          <li key={label}>
            {label}: {(proof.verificationStatus & bit) === bit ? "PASS" : "BLOCKED"}
          </li>
        ))}
      </ol>
      {proof.logs?.length ? (
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 8,
            background: "#101315",
            color: "#d9f99d",
            overflow: "auto",
            fontFamily: "ui-monospace, SFMono-Regular",
            fontSize: 12,
          }}
        >
          {proof.logs.join("\n")}
        </pre>
      ) : null}
    </RuntimeSurface>
  );
}
