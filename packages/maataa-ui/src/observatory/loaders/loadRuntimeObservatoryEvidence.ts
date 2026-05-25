import type { GovernanceState, RuntimeStat } from "../../types";

export type ScriptDatasetName = "brahmi" | "kharosthi" | "siddham";

export type ScriptToken = {
  script: ScriptDatasetName;
  glyph: string;
  codepoint: string;
  transliteration: string;
  phoneme: string;
  class_name: string;
  weight: number;
};

export type ScriptTokenDataset = {
  script: ScriptDatasetName;
  summary: {
    known: number;
    unknown: number;
    weight: number;
  };
  tokens: ScriptToken[];
};

export type GlyphVector = {
  script: ScriptDatasetName;
  glyph: string;
  codepoint: string;
  transliteration: string;
  weight: number;
  geometry: readonly number[];
  x: number;
  y: number;
};

export type RuntimeEvidenceFiles = {
  sha256sums: string;
  tokens: Record<ScriptDatasetName, string>;
  magv: Record<ScriptDatasetName, ArrayBufferLike | Uint8Array>;
};

export type RuntimeObservatoryEvidence =
  | {
      status: "REFERENCE_VALIDATED";
      governanceState: Extract<GovernanceState, "REFERENCE_VALIDATED">;
      aiBatchStatus: number;
      expectedAiBatchStatus: number;
      totalGlyphs: number;
      totalWeight: number;
      datasets: readonly ScriptTokenDataset[];
      glyphVectors: readonly GlyphVector[];
      stats: RuntimeStat[];
    }
  | {
      status: "BLOCKED";
      governanceState: Extract<GovernanceState, "VALIDATED_PREVIEW">;
      reason: string;
      expectedAiBatchStatus?: number;
      aiBatchStatus?: number;
      stats: RuntimeStat[];
    };

const DATASET_NAMES: readonly ScriptDatasetName[] = ["brahmi", "kharosthi", "siddham"];
const SCRIPT_KEYS: Record<number, ScriptDatasetName> = { 1: "brahmi", 2: "kharosthi", 3: "siddham" };
const MAGV_FRAME_BYTES = 32;

export function loadRuntimeObservatoryEvidence(
  files: RuntimeEvidenceFiles,
  aiBatchStatus: number,
): RuntimeObservatoryEvidence {
  try {
    return loadRuntimeObservatoryEvidenceUnsafe(files, aiBatchStatus);
  } catch (error) {
    return blocked(error instanceof Error ? error.message : "runtime evidence validation failed", aiBatchStatus);
  }
}

function loadRuntimeObservatoryEvidenceUnsafe(
  files: RuntimeEvidenceFiles,
  aiBatchStatus: number,
): RuntimeObservatoryEvidence {
  const manifest = parseSha256Sums(files.sha256sums);
  const datasets: ScriptTokenDataset[] = [];
  const vectors: GlyphVector[] = [];

  for (const script of DATASET_NAMES) {
    const tokenName = `${script}.tokens.json`;
    const magvName = `${script}.magv.bin`;
    const tokenText = files.tokens[script];
    const magvBytes = toUint8Array(files.magv[script]);

    const tokenHash = manifest.get(tokenName);
    const magvHash = manifest.get(magvName);
    if (!tokenHash || !magvHash) {
      return blocked(`missing manifest reference for ${script}`, aiBatchStatus);
    }

    if (sha256Hex(utf8Bytes(tokenText)) !== tokenHash) {
      return blocked(`token checksum mismatch for ${script}`, aiBatchStatus);
    }

    if (sha256Hex(magvBytes) !== magvHash) {
      return blocked(`MAGV checksum mismatch for ${script}`, aiBatchStatus);
    }

    const dataset = parseDataset(tokenText, script);
    const parsedVectors = parseMagvFrames(magvBytes, dataset);
    datasets.push(dataset);
    vectors.push(...parsedVectors);
  }

  const totalGlyphs = datasets.reduce((sum, dataset) => sum + dataset.tokens.length, 0);
  const totalWeight = datasets.reduce((sum, dataset) => sum + dataset.summary.weight, 0);
  const expectedAiBatchStatus = encodeAiBatchStatus(totalGlyphs, totalWeight);

  if (aiBatchStatus !== expectedAiBatchStatus) {
    return blocked("MOSF aiBatchStatus mismatch", aiBatchStatus, expectedAiBatchStatus);
  }

  return {
    status: "REFERENCE_VALIDATED",
    governanceState: "REFERENCE_VALIDATED",
    aiBatchStatus,
    expectedAiBatchStatus,
    totalGlyphs,
    totalWeight,
    datasets,
    glyphVectors: vectors,
    stats: [
      { label: "Governance", value: "REFERENCE_VALIDATED", tone: "nominal" },
      { label: "Glyphs", value: totalGlyphs, tone: "nominal" },
      { label: "Weight", value: totalWeight, tone: "nominal" },
      { label: "MOSF", value: `0x${aiBatchStatus.toString(16).padStart(8, "0")}`, tone: "nominal" },
    ],
  };
}

export function encodeAiBatchStatus(totalGlyphs: number, totalWeight: number): number {
  if (totalGlyphs < 0 || totalGlyphs > 0xffff || totalWeight < 0 || totalWeight > 0xffff) {
    throw new Error("aiBatchStatus totals exceed 16-bit packing bounds");
  }
  return (((totalGlyphs & 0xffff) << 16) | (totalWeight & 0xffff)) >>> 0;
}

function blocked(reason: string, aiBatchStatus?: number, expectedAiBatchStatus?: number): RuntimeObservatoryEvidence {
  return {
    status: "BLOCKED",
    governanceState: "VALIDATED_PREVIEW",
    reason,
    aiBatchStatus,
    expectedAiBatchStatus,
    stats: [
      { label: "Governance", value: "BLOCKED", tone: "recovery" },
      { label: "Reason", value: reason, tone: "recovery" },
    ],
  };
}

function parseSha256Sums(text: string): Map<string, string> {
  const manifest = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line.trim());
    if (!match) {
      throw new Error(`invalid SHA256SUMS line: ${line}`);
    }
    const [, digest, filename] = match;
    if (filename.includes("/") || filename.includes("\\") || filename.includes("assets/html")) {
      throw new Error(`unsafe manifest filename: ${filename}`);
    }
    manifest.set(filename, digest);
  }
  return manifest;
}

function parseDataset(text: string, expectedScript: ScriptDatasetName): ScriptTokenDataset {
  const parsed = JSON.parse(text) as ScriptTokenDataset;
  if (parsed.script !== expectedScript) {
    throw new Error(`dataset script mismatch: ${expectedScript}`);
  }
  if (!Array.isArray(parsed.tokens)) {
    throw new Error(`dataset tokens missing: ${expectedScript}`);
  }

  let known = 0;
  let weight = 0;
  for (const token of parsed.tokens) {
    if (token.script !== expectedScript) {
      throw new Error(`token script mismatch: ${expectedScript}`);
    }
    if (!Number.isInteger(token.weight) || token.weight < 0) {
      throw new Error(`invalid token weight: ${expectedScript}`);
    }
    known += token.class_name === "unknown" ? 0 : 1;
    weight += token.weight;
  }

  if (parsed.summary.known !== known || parsed.summary.weight !== weight) {
    throw new Error(`dataset summary mismatch: ${expectedScript}`);
  }

  return parsed;
}

function parseMagvFrames(bytes: Uint8Array, dataset: ScriptTokenDataset): GlyphVector[] {
  if (bytes.byteLength !== dataset.tokens.length * MAGV_FRAME_BYTES) {
    throw new Error(`MAGV byte length mismatch: ${dataset.script}`);
  }

  return dataset.tokens.map((token, index) => {
    const offset = index * MAGV_FRAME_BYTES;
    if (bytes[offset] !== 0x4d || bytes[offset + 1] !== 0x41 || bytes[offset + 2] !== 0x47 || bytes[offset + 3] !== 0x56) {
      throw new Error(`MAGV magic mismatch: ${dataset.script}[${index}]`);
    }

    const script = SCRIPT_KEYS[bytes[offset + 4]];
    if (script !== dataset.script) {
      throw new Error(`MAGV script mismatch: ${dataset.script}[${index}]`);
    }

    const geometry = Array.from(bytes.slice(offset + 7, offset + 27));
    const x = 24 + index * 42;
    const y = 28 + ((geometry[0] + geometry[5] + token.weight * 17) % 96);
    return {
      script,
      glyph: token.glyph,
      codepoint: token.codepoint,
      transliteration: token.transliteration,
      weight: token.weight,
      geometry,
      x,
      y,
    };
  });
}

function toUint8Array(input: ArrayBufferLike | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function sha256Hex(bytes: Uint8Array): string {
  const words = sha256Words(bytes);
  return words.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function sha256Words(bytes: Uint8Array): number[] {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const length = bytes.length;
  const paddedLength = (((length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[length] = 0x80;
  const bitLength = length * 8;
  padded[paddedLength - 4] = (bitLength >>> 24) & 0xff;
  padded[paddedLength - 3] = (bitLength >>> 16) & 0xff;
  padded[paddedLength - 2] = (bitLength >>> 8) & 0xff;
  padded[paddedLength - 1] = bitLength & 0xff;

  const schedule = new Array<number>(64);
  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    for (let index = 0; index < 16; index++) {
      const offset = chunk + index * 4;
      schedule[index] = ((padded[offset] << 24) | (padded[offset + 1] << 16) | (padded[offset + 2] << 8) | padded[offset + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index++) {
      const s0 = rotr(schedule[index - 15], 7) ^ rotr(schedule[index - 15], 18) ^ (schedule[index - 15] >>> 3);
      const s1 = rotr(schedule[index - 2], 17) ^ rotr(schedule[index - 2], 19) ^ (schedule[index - 2] >>> 10);
      schedule[index] = (schedule[index - 16] + s0 + schedule[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + constants[index] + schedule[index]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash;
}

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}
