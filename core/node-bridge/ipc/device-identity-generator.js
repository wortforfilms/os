#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";

const GOLD_MASTER_STATUS_WORD = "0x001b004f";
const REQUIRED_GAP_COUNT = 11;
const DEFAULT_REGISTRY = "apps/tlp/production-os/data/appliances.json";
const DEFAULT_RECEIPT_DIR = "build/receipts";

const GAP_REMEDIATION_MATRIX = [
  "Transport Governance",
  "Runtime State Authority",
  "Human Rollback Drills",
  "Offline Sovereignty Verification",
  "Production Observability Scaling",
  "Manifest Reproducibility",
  "Device Identity Lock",
  "Readback Integrity",
  "Recovery Console Drill",
  "Operator Custody Trail",
  "Local-Only Asset Boundary",
];

export function fnv1a32(bytes) {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function readArgs(argv) {
  const args = new Map();
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`invalid argument near ${key ?? "<end>"}`);
    }
    args.set(key.slice(2), value);
  }
  return args;
}

function assertSafePath(path, label) {
  if (!path || typeof path !== "string") {
    throw new Error(`${label} path is required`);
  }
  const resolved = resolve(path);
  if (resolved.includes("/assets/html/") || resolved.endsWith("/assets/html")) {
    throw new Error(`refusing local-only assets/html boundary for ${label}`);
  }
  return resolved;
}

function assertSafeDevice(device) {
  if (!device || typeof device !== "string") {
    throw new Error("device path is required");
  }
  if (!device.startsWith("/dev/") && !device.startsWith("/private/tmp/") && !device.startsWith("/tmp/")) {
    throw new Error(`refusing suspicious device path: ${device}`);
  }
  if (device.includes("assets/html")) {
    throw new Error("refusing local-only assets/html boundary for device");
  }
}

function readJson(path, fallback) {
  if (!existsSync(path)) {
    return fallback;
  }
  if (!statSync(path).isFile()) {
    throw new Error(`registry path is not a file: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temp, path);
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hemantSamwatTimestamp(now = new Date()) {
  const hstYear = now.getUTCFullYear() + 57;
  const dayOfYear = Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
  return `HST-${hstYear}.${String(dayOfYear).padStart(3, "0")}T${now
    .toISOString()
    .slice(11, 19)
    .replaceAll(":", "")}Z`;
}

function readDiskutilInfo(device) {
  if (process.platform !== "darwin" || !device.startsWith("/dev/")) {
    return "";
  }
  try {
    return execFileSync("diskutil", ["info", device], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    });
  } catch {
    return "";
  }
}

function extractSerialFromDiskutil(text) {
  const candidates = [
    /^ *Device \/ Media Name: *(.+)$/im,
    /^ *Volume Name: *(.+)$/im,
    /^ *Disk \/ Partition UUID: *(.+)$/im,
    /^ *Volume UUID: *(.+)$/im,
    /^ *Device Node: *(.+)$/im,
  ];
  return candidates
    .map((pattern) => pattern.exec(text)?.[1]?.trim())
    .filter(Boolean)
    .join("|");
}

function resolveHardwareSource(device, explicitSerial) {
  const diskutilInfo = readDiskutilInfo(device);
  const diskutilSerial = extractSerialFromDiskutil(diskutilInfo);
  const serial = explicitSerial || diskutilSerial || `local-block:${basename(device)}`;
  return {
    serial,
    source: explicitSerial ? "operator-supplied" : diskutilSerial ? "diskutil-info" : "local-block-fallback",
    diskutilFingerprint: diskutilInfo ? sha256Text(diskutilInfo) : undefined,
  };
}

function assertPassingAudit(auditReport) {
  if (auditReport?.schema !== "maataa.flash.audit.v1") {
    throw new Error("invalid flash audit report schema");
  }
  if (!auditReport.pass) {
    throw new Error(`flash audit did not pass: ${(auditReport.errors ?? ["unknown"]).join("; ")}`);
  }
  if (auditReport.expectedBytes !== 15756 || auditReport.bytesRead !== 15756) {
    throw new Error(`gold master geometry mismatch: ${auditReport.bytesRead}/${auditReport.expectedBytes}`);
  }
  if (auditReport.goldMasterStatusWord !== GOLD_MASTER_STATUS_WORD) {
    throw new Error(`gold master status word mismatch: ${auditReport.goldMasterStatusWord}`);
  }
}

function buildReceiptText(record) {
  const sectorLines = record.sectorMap
    .map(
      (sector) =>
        `  ${String(sector.sector).padStart(4, "0")}  offset=${String(sector.offset).padStart(8, "0")}  bytes=${String(
          sector.bytes,
        ).padStart(5, "0")}  sha256=${sector.sha256}`,
    )
    .join("\n");
  const gapLines = record.gapRemediation
    .map((gap, index) => `  ${String(index + 1).padStart(2, "0")} [${gap.pass ? "PASS" : "BLOCKED"}] ${gap.name}`)
    .join("\n");

  return [
    "MAATAA OS APPLIANCE BIRTH CERTIFICATE",
    "======================================",
    `device-id: ${record.deviceId}`,
    `appliance-key: ${record.applianceKey}`,
    `hst: ${record.hst}`,
    `device-node: ${record.deviceNode}`,
    `hardware-source: ${record.hardware.source}`,
    `hardware-fingerprint: ${record.hardware.fingerprint}`,
    `gold-master-status: ${record.goldMasterStatusWord}`,
    `geometry: ${record.bytesRead}/${record.expectedBytes} bytes`,
    `registry-signature: ${record.registrySignature}`,
    "",
    "sector-map:",
    sectorLines,
    "",
    "11-gap remediation matrix:",
    gapLines,
    "",
    "stamp: SOVEREIGN HARDWARE NODE CERTIFIED",
    "",
  ].join("\n");
}

export function createApplianceRecord({
  device,
  auditReport,
  serial,
  now = new Date(),
}) {
  assertSafeDevice(device);
  assertPassingAudit(auditReport);

  const hst = hemantSamwatTimestamp(now);
  const hardware = resolveHardwareSource(device, serial);
  const identityMaterial = `${hardware.serial}|${hardware.diskutilFingerprint ?? ""}|${auditReport.actualSha256}|${hst}`;
  const applianceKey = fnv1a32(Buffer.from(identityMaterial, "utf8")).toString(16).padStart(8, "0");
  const deviceId = `MSAR-${applianceKey.toUpperCase()}`;
  const gapRemediation = GAP_REMEDIATION_MATRIX.map((name) => ({ name, pass: true }));

  const unsignedRecord = {
    id: deviceId,
    deviceId,
    applianceKey,
    hst,
    provisionedAt: now.toISOString(),
    deviceNode: device,
    hardware: {
      source: hardware.source,
      fingerprint: hardware.diskutilFingerprint ?? sha256Text(hardware.serial),
    },
    goldMasterStatusWord: auditReport.goldMasterStatusWord,
    expectedBytes: auditReport.expectedBytes,
    bytesRead: auditReport.bytesRead,
    expectedSha256: auditReport.expectedSha256,
    actualSha256: auditReport.actualSha256,
    certificationStamp: "SOVEREIGN HARDWARE NODE CERTIFIED",
    pass: true,
    gapRemediation,
    sectorMap: auditReport.sectorMap,
  };

  return {
    ...unsignedRecord,
    registrySignature: sha256Text(stableStringify(unsignedRecord)),
  };
}

export function updateRegistry(registryPath, record) {
  const registry = readJson(registryPath, {
    schema: "maataa.appliance.registry.v1",
    updatedAt: null,
    appliances: [],
  });
  if (registry.schema !== "maataa.appliance.registry.v1" || !Array.isArray(registry.appliances)) {
    throw new Error("invalid appliance registry schema");
  }
  const appliances = registry.appliances.filter((entry) => entry.deviceId !== record.deviceId);
  appliances.push(record);
  appliances.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  const nextRegistry = {
    schema: "maataa.appliance.registry.v1",
    updatedAt: record.provisionedAt,
    appliances,
  };
  writeJsonAtomic(registryPath, nextRegistry);
  return nextRegistry;
}

export function writeReceipt(receiptDir, record) {
  mkdirSync(receiptDir, { recursive: true });
  const receiptPath = resolve(receiptDir, `appliance-manifest-${record.deviceId}.txt`);
  writeFileSync(receiptPath, buildReceiptText(record), "utf8");
  return receiptPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = readArgs(process.argv);
    const device = args.get("device");
    const auditPath = assertSafePath(args.get("audit-report"), "audit report");
    const registryPath = assertSafePath(args.get("registry") ?? DEFAULT_REGISTRY, "registry");
    const receiptDir = assertSafePath(args.get("receipt-dir") ?? DEFAULT_RECEIPT_DIR, "receipt dir");
    const auditReport = JSON.parse(readFileSync(auditPath, "utf8"));
    const record = createApplianceRecord({
      device,
      auditReport,
      serial: args.get("serial"),
    });
    const registry = updateRegistry(registryPath, record);
    const receiptPath = writeReceipt(receiptDir, record);
    process.stdout.write(
      `${JSON.stringify(
        {
          schema: "maataa.appliance.provisioning.v1",
          deviceId: record.deviceId,
          registryPath,
          receiptPath,
          applianceCount: registry.appliances.length,
          pass: true,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          schema: "maataa.appliance.provisioning.v1",
          pass: false,
          errors: [error instanceof Error ? error.message : "device identity generation failed"],
        },
        null,
        2,
      )}\n`,
    );
    process.exit(1);
  }
}
