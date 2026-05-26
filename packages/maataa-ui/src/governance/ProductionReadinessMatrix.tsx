import { RuntimeSurface } from "../components/status/RuntimeSurface";
import type { RuntimeStat } from "../types";

type GateState = "PASS" | "PREVIEW" | "STAGED" | "BLOCKED";

type ProductionGate = {
  domain: "MSAR" | "GURUKUL" | "RADIO";
  label: string;
  state: GateState;
  evidence: string;
};

const gateTone: Record<GateState, RuntimeStat["tone"]> = {
  PASS: "nominal",
  PREVIEW: "degraded",
  STAGED: "degraded",
  BLOCKED: "recovery",
};

export const PRODUCTION_READINESS_GATES: readonly ProductionGate[] = Object.freeze([
  {
    domain: "MSAR",
    label: "Static sector enforcement",
    state: "PASS",
    evidence: "HardenedFlashController enforces kernel/model/database sector boundaries with tests.",
  },
  {
    domain: "MSAR",
    label: "Hardware root of trust",
    state: "BLOCKED",
    evidence: "Synthetic identity exists; HSM/TPM secure boot loop not integrated.",
  },
  {
    domain: "MSAR",
    label: "Zero-allocation scheduler",
    state: "PREVIEW",
    evidence: "QEMU alpha is deterministic; heap-free kernel audit remains open.",
  },
  {
    domain: "MSAR",
    label: "Offline model inference",
    state: "STAGED",
    evidence: "Script matrices are active; Whisper/Piper/SDXL/ONNX weights are placeholders.",
  },
  {
    domain: "MSAR",
    label: "Loopback pressure recovery",
    state: "PASS",
    evidence: "TELEMETRY_PRESSURE_REPORT shows rollback and zero packet leakage.",
  },
  {
    domain: "GURUKUL",
    label: "Immutable frame matrix",
    state: "PASS",
    evidence: "PEDG and MSAR frame registries are frozen at module load.",
  },
  {
    domain: "GURUKUL",
    label: "Bundled educational assets",
    state: "STAGED",
    evidence: "Storyboard, style, and audio bundles are not yet committed.",
  },
  {
    domain: "GURUKUL",
    label: "Accessibility providers",
    state: "PREVIEW",
    evidence: "Provider skeletons exist; latency evidence is not recorded.",
  },
  {
    domain: "GURUKUL",
    label: "Learning analytics ledger",
    state: "PREVIEW",
    evidence: "Encrypted milestone writer exists in node bridge; app progress integration remains open.",
  },
  {
    domain: "RADIO",
    label: "Zero-drop audio IPC",
    state: "STAGED",
    evidence: "Radio state is represented; audio packet IPC path is not verified.",
  },
  {
    domain: "RADIO",
    label: "NCR appliance cluster config",
    state: "BLOCKED",
    evidence: "No Delhi/Noida/Gurugram autonomous deployment matrix is present.",
  },
  {
    domain: "RADIO",
    label: "Signed flashing gate",
    state: "PREVIEW",
    evidence: "Golden-image verification cross-checks hashes and hardening matrix; per-device admission remains open.",
  },
] as const);

function summarize(domain: ProductionGate["domain"]): RuntimeStat {
  const gates = PRODUCTION_READINESS_GATES.filter((gate) => gate.domain === domain);
  const blocked = gates.filter((gate) => gate.state === "BLOCKED").length;
  const passing = gates.filter((gate) => gate.state === "PASS").length;
  const state: GateState = blocked > 0 ? "BLOCKED" : passing === gates.length ? "PASS" : "PREVIEW";

  return {
    label: domain,
    value: state,
    tone: gateTone[state],
  };
}

export function ProductionReadinessMatrix() {
  const stats = [summarize("MSAR"), summarize("GURUKUL"), summarize("RADIO")];

  return (
    <RuntimeSurface
      title="Production Readiness Matrix"
      subtitle="PHKD hardening gates for appliance, Gurukul, and Radio surfaces"
      stats={stats}
      style={{
        background: "rgba(5, 8, 22, 0.72)",
        borderColor: "rgba(214, 165, 92, 0.22)",
        color: "#e8eeeb",
      }}
    >
      <div className="production-readiness-grid">
        {PRODUCTION_READINESS_GATES.map((gate) => (
          <article className={`production-gate ${gate.state.toLowerCase()}`} key={`${gate.domain}:${gate.label}`}>
            <header>
              <span>{gate.domain}</span>
              <strong>{gate.state}</strong>
            </header>
            <h3>{gate.label}</h3>
            <p>{gate.evidence}</p>
          </article>
        ))}
      </div>
    </RuntimeSurface>
  );
}
