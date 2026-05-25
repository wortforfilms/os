#!/usr/bin/env node
import { existsSync } from "node:fs";
import { auditFlashDevice, readHeartbeatStatus, readManifest, writeAuditReport } from "./flash-verifier.js";

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

function optionalManifest(path) {
  return path && existsSync(path) ? readManifest(path) : "";
}

try {
  const args = readArgs(process.argv);
  const scriptManifest = optionalManifest(args.get("script-manifest"));
  const packageManifest = optionalManifest(args.get("package-manifest"));
  const manifestText = [scriptManifest, packageManifest].filter(Boolean).join("\n");
  const heartbeat = args.get("heartbeat-frame")
    ? readHeartbeatStatus(args.get("heartbeat-frame"))
    : { word: Number.parseInt(args.get("heartbeat-word") ?? "0x001b004f", 16), source: "script-argument" };
  const expectedSha256 = args.get("expected-sha256") || undefined;
  const report = auditFlashDevice({
    device: args.get("device"),
    expectedBytes: Number.parseInt(args.get("expected-bytes") ?? "15756", 10),
    expectedSha256,
    expectedManifestEntry: args.get("expected-entry") ?? "gold-master-15756.bin",
    fallbackManifestEntry: args.get("fallback-entry") ?? "kernel/maataa-os.bin",
    manifestText,
    blockSize: Number.parseInt(args.get("block-size") ?? "4096", 10),
    heartbeatWord: heartbeat.word,
    heartbeatSource: heartbeat.source,
  });
  const output = args.get("output");
  if (output) {
    writeAuditReport(report, output);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.pass ? 0 : 1);
} catch (error) {
  const output = (() => {
    try {
      return readArgs(process.argv).get("output");
    } catch {
      return undefined;
    }
  })();
  const report = {
    schema: "maataa.flash.audit.v1",
    generatedAt: new Date().toISOString(),
    pass: false,
    certificationStamp: "BLOCKED",
    errors: [error instanceof Error ? error.message : "flash verifier failed"],
    sectorMap: [],
  };
  if (output) {
    writeAuditReport(report, output);
  }
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(1);
}
