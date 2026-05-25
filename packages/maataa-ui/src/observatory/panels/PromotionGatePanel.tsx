import { RuntimeRecovery } from "../../core/RuntimeRecovery";
import { RuntimeSurface } from "../../components/status/RuntimeSurface";
import { resolvePromotion, type PromotionProof } from "../../governance/PromotionMatrix";

export function PromotionGatePanel({ proof }: { proof: PromotionProof }) {
  const resolution = resolvePromotion(proof);

  if (!resolution.certified) {
    return <RuntimeRecovery reason={`Promotion gate blocked: ${resolution.missing.join(", ") || "certification bit missing"}`} />;
  }

  return (
    <RuntimeSurface title="Promotion Gates" subtitle="Native proof accepted" stats={resolution.stats}>
      <div style={{ display: "grid", gap: 8, fontFamily: "ui-monospace, SFMono-Regular", fontSize: 12 }}>
        <span>mathematical reproducibility: PASS</span>
        <span>structural tolerance stress: PASS</span>
        <span>temporal HST signature: PASS</span>
        <span>11-gap remediation matrix: PASS</span>
        <span>aiBatchStatus clearance bit: PASS</span>
      </div>
    </RuntimeSurface>
  );
}
