import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function createVirtualFileSystem() {
  const files = new Map();

  return {
    read(path) {
      return files.get(path) ?? null;
    },
    write(path, value) {
      files.set(path, value);
      return { path, bytes: Buffer.byteLength(String(value)) };
    },
    readBinary(path) {
      const value = files.get(path);
      return Buffer.isBuffer(value) ? Buffer.from(value) : null;
    },
    writeBinary(path, value) {
      const buffer = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value);
      files.set(path, buffer);
      return { path, bytes: buffer.byteLength };
    },
    list() {
      return [...files.keys()].sort();
    },
  };
}

export class SovereignProgressLedger {
  #secretKey;

  constructor(applianceStoragePath, hardwareFusedKey) {
    if (!applianceStoragePath || typeof applianceStoragePath !== "string") {
      throw new TypeError("applianceStoragePath must be a non-empty string");
    }
    if (!hardwareFusedKey || typeof hardwareFusedKey !== "string") {
      throw new TypeError("hardwareFusedKey must be a non-empty string");
    }

    this.storagePath = path.resolve(applianceStoragePath);
    this.cipherAlgorithm = "aes-256-gcm";
    this.#secretKey = crypto.scryptSync(hardwareFusedKey, "msar_salt", 32);
    fs.mkdirSync(this.storagePath, { recursive: true, mode: 0o700 });
  }

  commitMilestoneRecord(studentId, framePayload) {
    const normalizedStudentId = normalizeLedgerId(studentId);
    const payload = Buffer.isBuffer(framePayload) ? framePayload.toString("base64") : String(framePayload);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.cipherAlgorithm, this.#secretKey, iv);
    const runtimeMetadata = JSON.stringify({
      timestamp: Date.now(),
      integrity_lock: true,
      payload,
    });

    const encryptedBuffer = Buffer.concat([cipher.update(runtimeMetadata, "utf8"), cipher.final()]);
    const serializedPayload = JSON.stringify({
      version: 1,
      algorithm: this.cipherAlgorithm,
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      data: encryptedBuffer.toString("hex"),
    });

    const targetPath = path.join(this.storagePath, `dg_ledger_${normalizedStudentId}.dat`);
    const tempPath = `${targetPath}.tmp`;
    fs.writeFileSync(tempPath, serializedPayload, { flag: "w", encoding: "utf8", mode: 0o600 });
    fs.renameSync(tempPath, targetPath);

    return {
      path: targetPath,
      bytes: Buffer.byteLength(serializedPayload),
      encrypted: true,
    };
  }
}

function normalizeLedgerId(value) {
  const id = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    throw new TypeError("studentId must use only letters, numbers, underscore, or dash");
  }
  return id;
}
