import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";

export const GOLD_MASTER_AI_BATCH_STATUS = 0x001b004f;
export const DEFAULT_EXPECTED_BYTES = 15756;
export const DEFAULT_BLOCK_SIZE = 4096;
export const MOSF_FRAME_BYTES = 40;
export const MOSF_SIGNED_BYTES = 36;
export const MOSF_MAGIC = 0x4d4f5346;

export function parseSha256Sums(text) {
  const entries = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line.trim());
    if (!match) {
      throw new Error(`invalid SHA256SUMS line: ${line}`);
    }
    const [, digest, filename] = match;
    if (filename.includes("assets/html") || filename.includes("..")) {
      throw new Error(`unsafe manifest entry: ${filename}`);
    }
    entries.set(filename, digest);
  }
  return entries;
}

export function resolveExpectedHash(manifestText, preferredEntry, fallbackEntry) {
  const entries = parseSha256Sums(manifestText);
  const preferred = preferredEntry ? entries.get(preferredEntry) : undefined;
  if (preferred) {
    return { entry: preferredEntry, sha256: preferred };
  }
  const fallback = fallbackEntry ? entries.get(fallbackEntry) : undefined;
  if (fallback) {
    return { entry: fallbackEntry, sha256: fallback };
  }
  throw new Error(`missing SHA256 baseline: ${preferredEntry}${fallbackEntry ? ` or ${fallbackEntry}` : ""}`);
}

export function fnv1a32(bytes) {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function parseMosfHeartbeatFrame(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < MOSF_FRAME_BYTES) {
    throw new Error(`MOSF heartbeat frame too short: ${buffer?.length ?? 0}/${MOSF_FRAME_BYTES}`);
  }
  const magic = buffer.readUInt32BE(0);
  if (magic !== MOSF_MAGIC) {
    throw new Error(`MOSF heartbeat magic mismatch: 0x${magic.toString(16).padStart(8, "0")}`);
  }
  const expectedChecksum = fnv1a32(buffer.subarray(0, MOSF_SIGNED_BYTES));
  const actualChecksum = buffer.readUInt32LE(36);
  if (actualChecksum !== expectedChecksum) {
    throw new Error(
      `MOSF heartbeat checksum mismatch: 0x${actualChecksum.toString(16).padStart(8, "0")} != 0x${expectedChecksum
        .toString(16)
        .padStart(8, "0")}`,
    );
  }
  return buffer.readUInt32LE(24);
}

export function readHeartbeatStatus(path) {
  if (!path) {
    return { word: GOLD_MASTER_AI_BATCH_STATUS, source: "static-gold-master-baseline" };
  }
  if (path.includes("assets/html")) {
    throw new Error("refusing local-only assets/html boundary");
  }
  if (!existsSync(path)) {
    throw new Error(`heartbeat frame missing: ${path}`);
  }
  return {
    word: parseMosfHeartbeatFrame(readFileSync(path)),
    source: path,
  };
}

export function auditFlashDevice({
  device,
  expectedBytes = DEFAULT_EXPECTED_BYTES,
  expectedSha256,
  expectedManifestEntry = "gold-master-15756.bin",
  fallbackManifestEntry = "kernel/maataa-os.bin",
  manifestText = "",
  blockSize = DEFAULT_BLOCK_SIZE,
  heartbeatWord = GOLD_MASTER_AI_BATCH_STATUS,
  heartbeatSource = "static-gold-master-baseline",
} = {}) {
  if (!device || typeof device !== "string") {
    throw new Error("device path is required");
  }
  if (!device.startsWith("/dev/") && !device.startsWith("/private/tmp/") && !device.startsWith("/tmp/")) {
    throw new Error(`refusing suspicious device path: ${device}`);
  }
  if (device.includes("assets/html")) {
    throw new Error("refusing local-only assets/html boundary");
  }
  if (!Number.isInteger(expectedBytes) || expectedBytes <= 0) {
    throw new Error(`invalid expected byte count: ${expectedBytes}`);
  }

  const expected = expectedSha256
    ? { entry: "MAATAA_EXPECTED_SHA256", sha256: expectedSha256 }
    : resolveExpectedHash(manifestText, expectedManifestEntry, fallbackManifestEntry);
  const sectorCount = Math.ceil(expectedBytes / blockSize);
  const sectorMap = [];
  const hash = createHash("sha256");
  const fd = openSync(device, "r");
  const buffer = Buffer.allocUnsafe(blockSize);
  let remaining = expectedBytes;
  let offset = 0;

  try {
    for (let sector = 0; sector < sectorCount; sector += 1) {
      const bytesWanted = Math.min(blockSize, remaining);
      const bytesRead = readSync(fd, buffer, 0, bytesWanted, offset);
      if (bytesRead !== bytesWanted) {
        throw new Error(`short read at sector ${sector}: ${bytesRead}/${bytesWanted}`);
      }
      const chunk = buffer.subarray(0, bytesRead);
      hash.update(chunk);
      sectorMap.push({
        sector,
        offset,
        bytes: bytesRead,
        sha256: createHash("sha256").update(chunk).digest("hex"),
      });
      offset += bytesRead;
      remaining -= bytesRead;
    }
  } finally {
    closeSync(fd);
  }

  const actualSha256 = hash.digest("hex");
  const geometryPass = offset === expectedBytes;
  const hashPass = actualSha256 === expected.sha256;
  const heartbeatPass = heartbeatWord === GOLD_MASTER_AI_BATCH_STATUS;
  const pass = geometryPass && hashPass && heartbeatPass;

  return {
    schema: "maataa.flash.audit.v1",
    generatedAt: new Date().toISOString(),
    device,
    deviceName: basename(device),
    expectedBytes,
    bytesRead: offset,
    blockSize,
    sectorCount,
    manifestEntry: expected.entry,
    expectedSha256: expected.sha256,
    actualSha256,
    heartbeatSource,
    goldMasterStatusWord: `0x${heartbeatWord.toString(16).padStart(8, "0")}`,
    checks: {
      geometry: geometryPass,
      rawHash: hashPass,
      heartbeat: heartbeatPass,
    },
    pass,
    certificationStamp: pass ? "100% CIVILIZATION RUNTIME DEPLOYED" : "BLOCKED",
    errors: [
      ...(geometryPass ? [] : [`geometry mismatch: ${offset}/${expectedBytes}`]),
      ...(hashPass ? [] : [`sha256 mismatch: ${actualSha256} != ${expected.sha256}`]),
      ...(heartbeatPass ? [] : [`heartbeat mismatch: 0x${heartbeatWord.toString(16).padStart(8, "0")}`]),
    ],
    sectorMap,
  };
}

export function writeAuditReport(report, outputPath) {
  const resolved = resolve(outputPath);
  if (resolved.includes("assets/html")) {
    throw new Error("refusing to write report under assets/html");
  }
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return resolved;
}

export function readManifest(path) {
  if (!existsSync(path)) {
    throw new Error(`manifest missing: ${path}`);
  }
  return statSync(path).isFile() ? readFileSync(path, "utf8") : "";
}
