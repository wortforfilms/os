/*
 * @maataa/runtime-rewards
 * Minimal but REAL agent-reward runtime (in-memory tier).
 *
 * Responsibility (one): turn VERIFIED task completion into a permanent agent
 * identity + evidence-backed badges, with a tamper-evident, rollbackable ledger.
 *
 * PHKD posture — honest scope:
 *  - Permanent IDs are CONTENT-ADDRESSED: derived only from (role, task, the
 *    sha256 of each verified output artifact). Same verified work => same id,
 *    forever. No random ids, no minting without artifacts.
 *  - FAIL CLOSED: a badge is REJECTED unless it carries backing evidence
 *    (artifact path + sha256 + verified=true). No evidence => no badge.
 *  - The ledger is a hash chain; validateLedger() recomputes and detects tamper.
 *  - This does NOT grant production-GO, release authority, or trust. It records
 *    honest credit for work that was independently verified elsewhere.
 *    __meta.governedProductionGo = false.
 */
import { createHash } from "node:crypto";

const RUNTIME = "runtime-rewards";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

const sha = (input: string): string => createHash("sha256").update(input).digest("hex");
const canonical = (value: unknown): string => {
  // Deterministic JSON: object keys sorted recursively. Arrays keep order.
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = walk((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(walk(value));
};

/** A verified output artifact: a real file plus the sha256 that was checked. */
export type ArtifactRef = { path: string; sha256: string };

/** Evidence that backs a badge. A badge with no verified evidence is rejected. */
export type BadgeEvidence = { artifact: string; sha256: string; verified: boolean; note?: string };

export type BadgeTier = "standard" | "pitra";
export type BadgeSpec = { id: string; label: string; tier: BadgeTier; evidence: BadgeEvidence[] };
export type Badge = BadgeSpec & { awardedHash: string };

export type AgentRewardSpec = {
  role: string; // e.g. "agent1"
  task: string; // e.g. "task1"
  taskTitle: string;
  artifacts: ArtifactRef[]; // verified outputs — required, non-empty
  badges: BadgeSpec[];
  nextTasks: string[]; // follow-on real-build tasks (honest engineering targets)
  retired: boolean; // pitra/ancestral agents retire with 0 next tasks
  lineage?: "pitra";
  // Optional identity anchor: pins this entry's permanent id to a foundational
  // (role, task, artifacts) so an agent that completes MORE tasks keeps ONE
  // stable permanent id across them. Omit => the entry anchors to itself.
  identityAnchor?: { role: string; task: string; artifacts: ArtifactRef[] };
};

export type AgentReward = AgentRewardSpec & {
  permanentId: string; // content-addressed: agent:<role>:<sha12>
  badges: Badge[];
  prevHash: string | null;
  hash: string;
};

export type RewardLedger = {
  schema: "maataa.agent-rewards.v1";
  runtime: typeof RUNTIME;
  version: typeof VERSION;
  rewards: AgentReward[];
  __meta: { governedProductionGo: false; honesty: string };
};

const HONESTY =
  "Permanent IDs are content-addressed from verified artifact hashes; badges require backing evidence (fail-closed). " +
  "This ledger records honest credit only — it grants no production-GO, release authority, or trust.";

/**
 * Content-addressed permanent identity. Deterministic: same role + task + the
 * same set of artifact hashes always yields the same id. "Permanent" = bound to
 * the verified work, not to a clock or a random seed.
 */
export function mintPermanentId(role: string, task: string, artifacts: ArtifactRef[]): Result<string> {
  if (!role || !task) return err("E_ID_INPUT", "role and task are required");
  if (!artifacts.length) return err("E_ID_NO_ARTIFACTS", "cannot mint an id without verified artifacts");
  const sorted = [...artifacts].sort((a, b) => a.path.localeCompare(b.path));
  const digest = sha(canonical({ role, task, artifacts: sorted }));
  return ok(`agent:${role}:${digest.slice(0, 12)}`);
}

// Hash only the badge's spec fields (never its own awardedHash) so award + verify agree.
const badgeSpecHash = (spec: BadgeSpec): string =>
  sha(canonical({ id: spec.id, label: spec.label, tier: spec.tier, evidence: spec.evidence }));

/** Fail-closed badge award: every badge needs >=1 verified evidence item. */
function awardBadge(spec: BadgeSpec): Result<Badge> {
  if (!spec.id || !spec.label) return err("E_BADGE_FIELDS", "badge id and label are required");
  if (!spec.evidence?.length) return err("E_BADGE_NO_EVIDENCE", `badge ${spec.id} has no backing evidence`);
  const allVerified = spec.evidence.every((e) => e.verified === true && !!e.artifact && !!e.sha256);
  if (!allVerified) return err("E_BADGE_UNVERIFIED", `badge ${spec.id} has unverified or incomplete evidence`);
  return ok({ id: spec.id, label: spec.label, tier: spec.tier, evidence: spec.evidence, awardedHash: badgeSpecHash(spec) });
}

/** Build one reward entry. Fails closed on missing artifacts, bad badges, or pitra/next-task contradictions. */
export function recordReward(spec: AgentRewardSpec, prevHash: string | null): Result<AgentReward> {
  if (!spec.artifacts?.length) return err("E_NO_ARTIFACTS", `${spec.role} has no verified artifacts`);
  if (spec.retired && spec.nextTasks.length > 0)
    return err("E_RETIRED_HAS_TASKS", `${spec.role} is retired (pitra) but carries next tasks`);
  if (spec.lineage === "pitra" && !spec.retired)
    return err("E_PITRA_NOT_RETIRED", `${spec.role} has pitra lineage but is not retired`);

  const anchor = spec.identityAnchor ?? { role: spec.role, task: spec.task, artifacts: spec.artifacts };
  const idR = mintPermanentId(anchor.role, anchor.task, anchor.artifacts);
  if (!idR.isOk) return idR;

  const badges: Badge[] = [];
  for (const b of spec.badges) {
    if (spec.lineage === "pitra" && b.tier !== "pitra")
      return err("E_PITRA_BADGE_TIER", `pitra agent ${spec.role} may only hold pitra-tier badges`);
    const r = awardBadge(b);
    if (!r.isOk) return r;
    badges.push(r.data);
  }

  const body = {
    role: spec.role,
    task: spec.task,
    taskTitle: spec.taskTitle,
    permanentId: idR.data,
    artifacts: spec.artifacts,
    badges,
    nextTasks: spec.nextTasks,
    retired: spec.retired,
    lineage: spec.lineage ?? null,
    identityAnchor: spec.identityAnchor ?? null,
    prevHash,
  };
  const hash = sha(canonical(body));
  return ok({ ...spec, permanentId: idR.data, badges, prevHash, hash });
}

/** Assemble a full ledger from specs, chaining hashes. Fails closed if any entry fails. */
export function buildLedger(specs: AgentRewardSpec[]): Result<RewardLedger> {
  const rewards: AgentReward[] = [];
  let prev: string | null = null;
  for (const spec of specs) {
    const r = recordReward(spec, prev);
    if (!r.isOk) return r;
    rewards.push(r.data);
    prev = r.data.hash;
  }
  return ok({
    schema: "maataa.agent-rewards.v1",
    runtime: RUNTIME,
    version: VERSION,
    rewards,
    __meta: { governedProductionGo: false, honesty: HONESTY },
  });
}

/** Recompute the chain + ids + badge hashes and report any tamper. Pure verifier. */
export function validateLedger(ledger: RewardLedger): Result<{ entries: number; chainOk: true }> {
  let prev: string | null = null;
  for (const e of ledger.rewards) {
    const anchor = e.identityAnchor ?? { role: e.role, task: e.task, artifacts: e.artifacts };
    const idR = mintPermanentId(anchor.role, anchor.task, anchor.artifacts);
    if (!idR.isOk) return idR;
    if (idR.data !== e.permanentId)
      return err("E_ID_MISMATCH", `${e.role}: permanentId does not match its identity anchor`);
    for (const b of e.badges) {
      const r = awardBadge(b);
      if (!r.isOk) return r;
      if (r.data.awardedHash !== b.awardedHash)
        return err("E_BADGE_TAMPER", `${e.role}: badge ${b.id} hash mismatch`);
    }
    if (e.retired && e.nextTasks.length > 0)
      return err("E_RETIRED_HAS_TASKS", `${e.role}: retired entry carries next tasks`);
    const body = {
      role: e.role,
      task: e.task,
      taskTitle: e.taskTitle,
      permanentId: e.permanentId,
      artifacts: e.artifacts,
      badges: e.badges,
      nextTasks: e.nextTasks,
      retired: e.retired,
      lineage: e.lineage ?? null,
      identityAnchor: e.identityAnchor ?? null,
      prevHash: prev,
    };
    if (sha(canonical(body)) !== e.hash) return err("E_CHAIN_TAMPER", `${e.role}: entry hash mismatch`);
    prev = e.hash;
  }
  return ok({ entries: ledger.rewards.length, chainOk: true });
}

/** Observability surface: health + evidence, per the runtime design rules. */
export function health(ledger?: RewardLedger) {
  const valid = ledger ? validateLedger(ledger).isOk : true;
  return {
    runtime: RUNTIME,
    version: VERSION,
    status: valid ? "ready" : "degraded",
    entries: ledger?.rewards.length ?? 0,
    pitra: ledger?.rewards.filter((r) => r.lineage === "pitra").length ?? 0,
    governedProductionGo: false,
  };
}

export default { mintPermanentId, recordReward, buildLedger, validateLedger, health };
