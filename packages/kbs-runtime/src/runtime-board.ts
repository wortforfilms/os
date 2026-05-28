export type KbsRuntimeStatus = "OPERATIONAL" | "DEGRADED" | "MAINTENANCE" | "OFFLINE" | "UNCLASSIFIED";

export interface KbsRuntimeRecord {
  id: number;
  name: string;
  family: string;
  status: KbsRuntimeStatus;
  uptime: number | null;
}

const runtimeFamilies = [
  ["Core Runtimes", ["KBS Core", "PHKD Engine", "Governance Core", "Identity Runtime", "Evidence Core", "Audit Core"]],
  ["Knowledge Runtimes", ["Ingestion Runtime", "Search Runtime", "Graph Runtime", "Claim Engine", "Citation Runtime", "Provenance Runtime", "Domain Runtime"]],
  ["Ecosystem Runtimes", ["Lipi Runtime", "TLP Runtime", "Maataa Runtime", "Radio Runtime", "Brahmini Chain", "InvestorHub", "Gurukul Runtime", "Saptadhaatu"]],
  ["Governance Runtimes", ["Review Engine", "Moderation Engine", "Dispute Runtime", "Scholar Profiles", "Policies", "Compliance", "PHKD Monitor"]],
  ["Engineering Runtimes", ["API Gateway", "Service Mesh", "Data Pipeline", "Cache Runtime", "Queue Runtime", "Storage Runtime"]],
  ["Observability Runtimes", ["Metrics Runtime", "Logging Runtime", "Tracing Runtime", "Alert Runtime", "Dashboard Runtime"]],
  ["Security Runtimes", ["Auth Runtime", "Access Runtime", "Threat Runtime", "Crypto Runtime", "Backup Runtime", "Attestation Runtime"]],
  ["Integration Runtimes", ["Third Party Runtime", "Webhook Runtime", "SDK Runtime", "Import/Export", "Connector Runtime"]],
  ["Operations Runtimes", ["Deployment Runtime", "Config Runtime", "Release Runtime", "Incident Runtime", "Runbook Runtime"]]
] as const;

export const kbsRuntimeBoard: KbsRuntimeRecord[] = runtimeFamilies.flatMap(([family, runtimes]) =>
  runtimes.map((name, index) => {
    const id = runtimeFamilies.slice(0, runtimeFamilies.findIndex(([candidate]) => candidate === family)).reduce((total, [, items]) => total + items.length, 0) + index + 1;
    return {
      id,
      name,
      family,
      status: resolveRuntimeStatus(name),
      uptime: resolveRuntimeStatus(name) === "OFFLINE" ? null : Number((99.96 - id * 0.003).toFixed(2))
    };
  })
);

export function summarizeKbsRuntimeBoard(records: KbsRuntimeRecord[] = kbsRuntimeBoard) {
  const counts = records.reduce<Record<KbsRuntimeStatus, number>>((accumulator, record) => {
    accumulator[record.status] += 1;
    return accumulator;
  }, { OPERATIONAL: 0, DEGRADED: 0, MAINTENANCE: 0, OFFLINE: 0, UNCLASSIFIED: 0 });
  return {
    totalRuntimes: records.length,
    healthScore: 92,
    ...counts,
    productionReady: false,
    finalStatus: "GOVERNED_PRODUCTION_NO_GO" as const
  };
}

function resolveRuntimeStatus(name: string): KbsRuntimeStatus {
  if (name === "Brahmini Chain" || name === "Crypto Runtime") return "DEGRADED";
  if (name === "Attestation Runtime" || name === "Access Runtime") return "MAINTENANCE";
  if (name === "Third Party Runtime") return "OFFLINE";
  if (name === "Webhook Runtime") return "UNCLASSIFIED";
  return "OPERATIONAL";
}
