import { RuntimeRecovery } from "../../core/RuntimeRecovery";
import { RuntimeSurface } from "../../components/status/RuntimeSurface";
import type { RuntimeStat } from "../../types";

export type FlashAuditSector = {
  sector: number;
  offset: number;
  bytes: number;
  sha256: string;
};

export type FlashAuditReport = {
  schema: "maataa.flash.audit.v1";
  generatedAt: string;
  device?: string;
  deviceName?: string;
  expectedBytes?: number;
  bytesRead?: number;
  blockSize?: number;
  sectorCount?: number;
  manifestEntry?: string;
  expectedSha256?: string;
  actualSha256?: string;
  heartbeatSource?: string;
  goldMasterStatusWord?: string;
  checks?: {
    geometry?: boolean;
    rawHash?: boolean;
    heartbeat?: boolean;
  };
  pass: boolean;
  certificationStamp: string;
  errors?: readonly string[];
  sectorMap?: readonly FlashAuditSector[];
};

export function ManifestPanel({ report, loading }: { report?: FlashAuditReport; loading?: boolean }) {
  if (loading) {
    return <RuntimeSurface title="Manifest" subtitle="Reading post-flash audit report" loading />;
  }

  if (!report) {
    return <RuntimeRecovery reason="post-flash audit report missing" />;
  }

  if (!report.pass) {
    return <RuntimeRecovery reason={(report.errors ?? ["post-flash audit blocked"]).join("; ")} />;
  }

  return (
    <RuntimeSurface
      title="Manifest"
      subtitle="Post-flash hardware audit"
      stats={statsForReport(report)}
      style={{ borderColor: "#0f766e" }}
    >
      <div
        style={{
          border: "1px solid #0f766e",
          borderRadius: 8,
          padding: 12,
          color: "#065f46",
          background: "#ecfdf5",
          fontFamily: "ui-monospace, SFMono-Regular",
          fontWeight: 800,
          textAlign: "center",
        }}
      >
        100% CIVILIZATION RUNTIME DEPLOYED
      </div>
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
        {sectorMapText(report)}
      </pre>
    </RuntimeSurface>
  );
}

function statsForReport(report: FlashAuditReport): RuntimeStat[] {
  return [
    { label: "Device", value: report.deviceName ?? "raw", tone: "nominal" },
    { label: "Bytes", value: `${report.bytesRead ?? 0}/${report.expectedBytes ?? 0}`, tone: "nominal" },
    { label: "Sectors", value: report.sectorCount ?? report.sectorMap?.length ?? 0, tone: "nominal" },
    { label: "Heartbeat", value: report.goldMasterStatusWord ?? "missing", tone: "nominal" },
  ];
}

function sectorMapText(report: FlashAuditReport): string {
  const lines = [
    `schema=${report.schema}`,
    `generated=${report.generatedAt}`,
    `manifest=${report.manifestEntry ?? "unknown"}`,
    `expected=${report.expectedSha256 ?? "unknown"}`,
    `actual=${report.actualSha256 ?? "unknown"}`,
    `heartbeatSource=${report.heartbeatSource ?? "unknown"}`,
    `geometry=${report.checks?.geometry ? "PASS" : "BLOCKED"}`,
    `rawHash=${report.checks?.rawHash ? "PASS" : "BLOCKED"}`,
    `heartbeat=${report.checks?.heartbeat ? "PASS" : "BLOCKED"}`,
    "",
  ];

  for (const sector of report.sectorMap ?? []) {
    lines.push(
      `sector=${sector.sector.toString().padStart(4, "0")} offset=${sector.offset
        .toString()
        .padStart(8, "0")} bytes=${sector.bytes.toString().padStart(5, "0")} sha256=${sector.sha256}`,
    );
  }

  return lines.join("\n");
}
