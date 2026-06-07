/*
 * @maataa/runtime-merkle
 * Minimal but REAL deterministic SHA-256 Merkle tree for evidence integrity.
 *
 * Honest scope: real cryptographic hashing (node:crypto), real inclusion proofs
 * that verify against the root. This is an evidence-integrity data structure —
 * NOT a blockchain, NOT consensus, NOT a distributed ledger, NOT "validators".
 * governedProductionGo stays false. Fail-closed.
 */
import { createHash } from "node:crypto";

const RUNTIME = "runtime-merkle";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const hashPair = (a: string, b: string) => sha(`${a}${b}`);
const hashLeaf = (data: string) => sha(`\x00${data}`); // leaf-prefix to resist 2nd-preimage

export type ProofStep = { sibling: string; position: "left" | "right" };

let leaves: string[] = []; // hashed leaves

export function reset(): void { leaves = []; }

/** (1) Build the tree from raw data items (replaces current leaves). Fail-closed on empty. */
export function build(items: string[]): Result<{ size: number; root: string }> {
  if (!Array.isArray(items) || items.length === 0) return err("empty", "build: at least one item required");
  if (items.some((i) => typeof i !== "string")) return err("invalid_item", "build: all items must be strings");
  leaves = items.map(hashLeaf);
  return ok({ size: leaves.length, root: computeRoot(leaves) });
}

/** (2) Append a single data item, returning its leaf index. */
export function append(item: string): Result<{ index: number; size: number }> {
  if (typeof item !== "string") return err("invalid_item", "append: item must be a string");
  leaves.push(hashLeaf(item));
  return ok({ index: leaves.length - 1, size: leaves.length });
}

/** (3) Current Merkle root. Fail-closed when the tree is empty. */
export function root(): Result<{ root: string; size: number }> {
  if (leaves.length === 0) return err("empty", "root: tree is empty");
  return ok({ root: computeRoot(leaves), size: leaves.length });
}

/** (4) Number of leaves. */
export function size(): Result<{ size: number }> {
  return ok({ size: leaves.length });
}

/** (5) Inclusion proof for a leaf index: ordered sibling hashes from leaf to root. */
export function proof(index: number): Result<{ index: number; leaf: string; steps: ProofStep[] }> {
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) {
    return err("bad_index", `proof: index ${index} out of range [0, ${leaves.length})`);
  }
  const steps: ProofStep[] = [];
  let level = leaves.slice();
  let idx = index;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i]; // duplicate last if odd
      if (i === idx || i + 1 === idx) {
        if (idx % 2 === 0) steps.push({ sibling: right, position: "right" });
        else steps.push({ sibling: left, position: "left" });
      }
      next.push(hashPair(left, right));
    }
    idx = Math.floor(idx / 2);
    level = next;
  }
  return ok({ index, leaf: leaves[index], steps });
}

/** (6) Verify a proof: recompute the root from a raw item + steps and compare. */
export function verify(item: string, steps: ProofStep[], expectedRoot: string): Result<{ valid: boolean; computedRoot: string }> {
  if (typeof item !== "string") return err("invalid_item", "verify: item must be a string");
  if (!Array.isArray(steps)) return err("invalid_steps", "verify: steps must be an array");
  if (typeof expectedRoot !== "string" || expectedRoot.length === 0) return err("invalid_root", "verify: expectedRoot required");
  let acc = hashLeaf(item);
  for (const s of steps) {
    if (s.position === "right") acc = hashPair(acc, s.sibling);
    else if (s.position === "left") acc = hashPair(s.sibling, acc);
    else return err("invalid_step", `verify: bad position '${(s as any).position}'`);
  }
  return ok({ valid: acc === expectedRoot, computedRoot: acc });
}

function computeRoot(level: string[]): string {
  let cur = level.slice();
  while (cur.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      const left = cur[i];
      const right = i + 1 < cur.length ? cur[i + 1] : cur[i];
      next.push(hashPair(left, right));
    }
    cur = next;
  }
  return cur[0];
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { leaves: number; root: string | null; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["build", "append", "root", "size", "proof", "verify"],
    evidence: {
      leaves: leaves.length,
      root: leaves.length ? computeRoot(leaves) : null,
      notes: [
        "real SHA-256 Merkle tree: deterministic root + verifiable inclusion proofs (evidence integrity)",
        "NOT a blockchain / consensus / distributed ledger; NO validators; NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
