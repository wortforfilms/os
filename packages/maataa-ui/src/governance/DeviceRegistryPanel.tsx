import { RuntimeRecovery } from "../core/RuntimeRecovery";
import { RuntimeSurface } from "../components/status/RuntimeSurface";
import type { RuntimeStat } from "../types";

export const GOLD_MASTER_STATUS_WORD = "0x001b004f";
export const REQUIRED_GAP_REMEDIATION_COUNT = 11;

export type ApplianceSector = {
  sector: number;
  offset: number;
  bytes: number;
  sha256: string;
};

export type ApplianceGapRemediation = {
  name: string;
  pass: boolean;
};

export type ApplianceRegistryRecord = {
  id: string;
  deviceId: string;
  applianceKey: string;
  hst: string;
  provisionedAt: string;
  deviceNode: string;
  hardware: {
    source: string;
    fingerprint: string;
  };
  goldMasterStatusWord: string;
  expectedBytes: number;
  bytesRead: number;
  expectedSha256: string;
  actualSha256: string;
  certificationStamp: string;
  pass: boolean;
  gapRemediation: readonly ApplianceGapRemediation[];
  sectorMap: readonly ApplianceSector[];
  registrySignature: string;
};

export type ApplianceRegistry = {
  schema: "maataa.appliance.registry.v1";
  updatedAt: string | null;
  appliances: readonly ApplianceRegistryRecord[];
};

export function DeviceRegistryPanel({
  registry,
  loading,
}: {
  registry?: ApplianceRegistry;
  loading?: boolean;
}) {
  if (loading) {
    return <RuntimeSurface title="Device Registry" subtitle="Reading local appliance compliance register" loading />;
  }

  const validation = validateRegistry(registry);
  if (!validation.pass) {
    return <RuntimeRecovery reason={validation.reason} />;
  }

  const appliances = registry?.appliances ?? [];

  return (
    <RuntimeSurface
      title="Device Registry"
      subtitle="Offline hardware birth certificates"
      stats={statsForRegistry(registry)}
      style={{ borderColor: "#334155" }}
    >
      {appliances.length === 0 ? (
        <div
          style={{
            border: "1px solid #d6d3d1",
            borderRadius: 8,
            padding: 12,
            fontFamily: "ui-monospace, SFMono-Regular",
            color: "#57534e",
          }}
        >
          NO CERTIFIED APPLIANCE RECORDS REGISTERED
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {appliances.map((appliance) => (
            <ApplianceCard key={appliance.deviceId} appliance={appliance} />
          ))}
        </div>
      )}
    </RuntimeSurface>
  );
}

function ApplianceCard({ appliance }: { appliance: ApplianceRegistryRecord }) {
  if (!isCertifiedAppliance(appliance)) {
    return <RuntimeRecovery reason={`appliance registry record blocked: ${appliance.deviceId}`} />;
  }

  return (
    <article
      style={{
        display: "grid",
        gap: 10,
        border: "1px solid #0f766e",
        borderRadius: 8,
        padding: 12,
        background: "#ecfdf5",
      }}
    >
      <svg viewBox="0 0 640 128" role="img" aria-label={`${appliance.deviceId} certified hardware serial card`}>
        <rect x="4" y="4" width="632" height="120" rx="6" fill="#052e2b" stroke="#5eead4" strokeWidth="2" />
        <text x="24" y="34" fill="#ccfbf1" fontFamily="ui-monospace, SFMono-Regular" fontSize="18" fontWeight="700">
          {appliance.deviceId}
        </text>
        <text x="24" y="62" fill="#99f6e4" fontFamily="ui-monospace, SFMono-Regular" fontSize="13">
          HST {appliance.hst}
        </text>
        <text x="24" y="86" fill="#99f6e4" fontFamily="ui-monospace, SFMono-Regular" fontSize="13">
          MOSF {appliance.goldMasterStatusWord} | BYTES {appliance.bytesRead}/{appliance.expectedBytes}
        </text>
        <text x="24" y="110" fill="#d9f99d" fontFamily="ui-monospace, SFMono-Regular" fontSize="13">
          {appliance.certificationStamp}
        </text>
      </svg>
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
        {serialLayout(appliance)}
      </pre>
    </article>
  );
}

function validateRegistry(registry?: ApplianceRegistry): { pass: boolean; reason: string } {
  if (!registry) {
    return { pass: false, reason: "appliance registry missing" };
  }
  if (registry.schema !== "maataa.appliance.registry.v1") {
    return { pass: false, reason: "appliance registry schema mismatch" };
  }
  const blocked = registry.appliances.find((appliance) => !isCertifiedAppliance(appliance));
  if (blocked) {
    return { pass: false, reason: `appliance certification blocked: ${blocked.deviceId}` };
  }
  return { pass: true, reason: "nominal" };
}

function isCertifiedAppliance(appliance: ApplianceRegistryRecord): boolean {
  return (
    appliance.pass === true &&
    appliance.goldMasterStatusWord === GOLD_MASTER_STATUS_WORD &&
    appliance.expectedBytes === 15756 &&
    appliance.bytesRead === 15756 &&
    appliance.expectedSha256 === appliance.actualSha256 &&
    appliance.gapRemediation.length === REQUIRED_GAP_REMEDIATION_COUNT &&
    appliance.gapRemediation.every((gap) => gap.pass) &&
    appliance.registrySignature.length === 64
  );
}

function statsForRegistry(registry?: ApplianceRegistry): RuntimeStat[] {
  const appliances = registry?.appliances ?? [];
  const certified = appliances.filter(isCertifiedAppliance).length;
  return [
    { label: "Registered", value: appliances.length, tone: "nominal" },
    { label: "Certified", value: certified, tone: certified === appliances.length ? "nominal" : "recovery" },
    { label: "Updated", value: registry?.updatedAt ?? "never", tone: "nominal" },
  ];
}

function serialLayout(appliance: ApplianceRegistryRecord): string {
  const sectors = appliance.sectorMap
    .map(
      (sector) =>
        `sector=${sector.sector.toString().padStart(4, "0")} offset=${sector.offset
          .toString()
          .padStart(8, "0")} bytes=${sector.bytes.toString().padStart(5, "0")} sha256=${sector.sha256}`,
    )
    .join("\n");
  const gaps = appliance.gapRemediation
    .map((gap, index) => `${String(index + 1).padStart(2, "0")} ${gap.pass ? "PASS" : "BLOCKED"} ${gap.name}`)
    .join("\n");

  return [
    `device=${appliance.deviceId}`,
    `key=${appliance.applianceKey}`,
    `hst=${appliance.hst}`,
    `node=${appliance.deviceNode}`,
    `hardware=${appliance.hardware.source}:${appliance.hardware.fingerprint}`,
    `signature=${appliance.registrySignature}`,
    "",
    "gap-remediation:",
    gaps,
    "",
    "sector-map:",
    sectors,
  ].join("\n");
}
