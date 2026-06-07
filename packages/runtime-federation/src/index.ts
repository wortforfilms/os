/*
 * @maataa/runtime-federation
 * REAL cross-runtime integration glue. Wires the federated runtimes together:
 * bootstrap topology, aggregate health, KG→validation claims, validation→registry
 * evidence resolution, and governance-based release-readiness enforcement.
 *
 * Honest scope: in-memory tier; composes runtimes that are each NOT production-GO,
 * so this is NOT production-GO either. No fabrication — every function calls the
 * real runtime APIs.
 */
import { createHash } from "node:crypto";
import * as kg from "../../runtime-knowledge-graph/src/index.ts";
import * as validation from "../../runtime-validation/src/index.ts";
import * as registry from "../../runtime-hkd-registry/src/index.ts";
import * as governance from "../../runtime-governance/src/index.ts";
import * as observability from "../../runtime-observability/src/index.ts";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

const RUNTIMES = { kg, validation, registry, governance, observability };
const NAMES: Record<string, string> = {
  kg: "runtime-knowledge-graph", validation: "runtime-validation", registry: "runtime-hkd-registry",
  governance: "runtime-governance", observability: "runtime-observability",
};

/** (1) Bootstrap: report each runtime's real health into observability + link the
 * dependency topology. Returns the live topology graph. */
export function bootstrap(): Result<{ nodes: number; edges: number }> {
  for (const [key, mod] of Object.entries(RUNTIMES)) {
    observability.report(NAMES[key], mod.health().status);
  }
  observability.link("runtime-mission", "runtime-knowledge-graph", "reads");
  observability.link("runtime-validation", "runtime-knowledge-graph", "validates");
  observability.link("runtime-validation", "runtime-hkd-registry", "cites-evidence");
  observability.link("runtime-mission", "runtime-governance", "proposes-to");
  const topo = observability.getTopology();
  if (!topo.isOk) return topo as Err;
  return ok({ nodes: topo.data.nodes.length, edges: topo.data.edges.length });
}

/** (2) Federation health: aggregate real health() of every runtime. */
export function federationHealth(): Result<{ allReady: boolean; runtimes: Array<{ runtime: string; status: string }> }> {
  const runtimes = Object.entries(RUNTIMES).map(([key, mod]) => ({ runtime: NAMES[key], status: mod.health().status }));
  return ok({ allReady: runtimes.every((r) => r.status === "ready"), runtimes });
}

/** (3) KG → validation: create a real KG entity, then submit it as a validation claim. */
export async function submitKgClaim(
  typeId: string,
  payload: unknown,
  evidence: validation.EvidenceItem[],
  methodology: validation.MethodologySpec,
): Promise<Result<{ entityId: string; validationId: string }>> {
  const ent = await kg.addEntity(typeId, payload);
  if (!ent.isOk) return err("kg_entity_failed", ent.error.detail);
  const claim = await validation.submitClaim({ runtime: "runtime-knowledge-graph", entityId: ent.data.id }, evidence, methodology);
  if (!claim.isOk) return err("validation_failed", claim.error.detail);
  return ok({ entityId: ent.data.id, validationId: claim.data.validationId });
}

/** (4) validation → registry: resolve every evidence ref of a validation against
 * the hkd-registry ledger (real verify()). */
export async function resolveValidationEvidence(
  validationId: string,
): Promise<Result<{ total: number; resolved: number; unresolved: string[] }>> {
  const rec = await validation.assess(validationId);
  if (!rec.isOk) return err("unknown_validation", rec.error.detail);
  const refs = rec.data.evidence || [];
  const unresolved: string[] = [];
  let resolved = 0;
  for (const e of refs) {
    const v = await registry.verify(e.ref.id);
    if (v.isOk && v.data.signatureValid) resolved += 1;
    else unresolved.push(e.ref.id);
  }
  return ok({ total: refs.length, resolved, unresolved });
}

/** (5) Governance-based release readiness: evaluate a release context against a
 * standard policy pack. Fail-closed: missing hardware attestation / quorum blocks. */
export function enforceReleaseReadiness(ctx: Record<string, unknown>): Result<{ decision: "allow" | "block"; violations: number }> {
  governance.reset();
  governance.definePolicy({ name: "hardware-attested", key: "hardwareAttested", op: "truthy", severity: "block" });
  governance.definePolicy({ name: "operator-quorum", key: "quorum", op: "gte", value: 2, severity: "block" });
  governance.definePolicy({ name: "signer-verified", key: "signerVerified", op: "truthy", severity: "block" });
  const r = governance.enforce(ctx);
  if (!r.isOk) return r as Err;
  return ok({ decision: r.data.decision, violations: r.data.violations.length });
}

/** (6) Trace a claim's lineage across runtimes via observability.emit/getLineage. */
export async function traceClaimLineage(
  typeId: string, payload: unknown, evidence: validation.EvidenceItem[], methodology: validation.MethodologySpec,
): Promise<Result<{ eventId: string; hops: number }>> {
  const r = await submitKgClaim(typeId, payload, evidence, methodology);
  if (!r.isOk) return r as Err;
  const eventId = `claim:${r.data.validationId}`;
  observability.emit(eventId, "runtime-knowledge-graph", r.data.entityId);
  observability.emit(eventId, "runtime-validation", r.data.validationId);
  for (const e of evidence) observability.emit(eventId, "runtime-hkd-registry", e.ref.id);
  const lin = observability.getLineage(eventId);
  if (!lin.isOk) return lin as Err;
  return ok({ eventId, hops: lin.data.chain.length });
}

/** (7) Verify the governance audit log hash-chain is intact (recompute + linkage). */
export function verifyGovernanceAuditChain(): Result<{ records: number; intact: boolean }> {
  const a = governance.audit();
  if (!a.isOk) return a as Err;
  let intact = true;
  let prev: string | null = null;
  for (const rec of a.data) {
    const expected = createHash("sha256")
      .update(`${rec.prevHash ?? ""}:${rec.decision}:${rec.contextDigest}:${rec.violations.length}`)
      .digest("hex");
    if (rec.hash !== expected || rec.prevHash !== prev) intact = false;
    prev = rec.hash;
  }
  return ok({ records: a.data.length, intact });
}

/** (8) Verify the hkd-registry ledger chain: every artifact verifies + prevHash links. */
export async function verifyRegistryLedgerChain(): Promise<Result<{ artifacts: number; intact: boolean }>> {
  const list = await registry.list();
  if (!list.isOk) return list as Err;
  let intact = true;
  let prev: string | null = null;
  for (const art of list.data) {
    const v = await registry.verify(art.id);
    if (!v.isOk || !v.data.signatureValid || art.prevHash !== prev) intact = false;
    prev = art.signature;
  }
  return ok({ artifacts: list.data.length, intact });
}

/** (9) Detect degraded federation members (any runtime not "ready"). */
export function detectDegraded(): Result<{ ready: boolean; degraded: string[] }> {
  const h = federationHealth();
  if (!h.isOk) return h as Err;
  const degraded = h.data.runtimes.filter((r) => r.status !== "ready").map((r) => r.runtime);
  return ok({ ready: degraded.length === 0, degraded });
}

/** (10) Two-hop neighbourhood of a KG entity (real edge traversal). */
export async function twoHopNeighbours(from: string): Promise<Result<{ direct: string[]; twoHop: string[] }>> {
  const d = await kg.query({ from });
  if (!d.isOk) return d as Err;
  const direct = [...new Set(d.data.map((m) => m.to))];
  const twoHop = new Set<string>();
  for (const mid of direct) {
    const next = await kg.query({ from: mid });
    if (next.isOk) for (const m of next.data) if (m.to !== from && !direct.includes(m.to)) twoHop.add(m.to);
  }
  return ok({ direct, twoHop: [...twoHop] });
}

/** (11) Composite federation report: health + topology + chain integrity. */
export async function federationReport(): Promise<Result<{ allReady: boolean; runtimes: number; auditIntact: boolean; ledgerIntact: boolean }>> {
  const h = federationHealth();
  const audit = verifyGovernanceAuditChain();
  const ledger = await verifyRegistryLedgerChain();
  if (!h.isOk) return h as Err;
  return ok({
    allReady: h.data.allReady,
    runtimes: h.data.runtimes.length,
    auditIntact: audit.isOk ? audit.data.intact : false,
    ledgerIntact: ledger.isOk ? ledger.data.intact : false,
  });
}

/** (12) Shortest path between two KG entities (BFS over real edges). */
export async function shortestPath(from: string, to: string): Promise<Result<{ path: string[]; hops: number } | null>> {
  const all = await kg.query({});
  if (!all.isOk) return all as Err;
  const adj = new Map<string, string[]>();
  for (const e of all.data) { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push(e.to); }
  const queue = [[from]];
  const seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === to) return ok({ path, hops: path.length - 1 });
    for (const next of adj.get(node) || []) {
      if (!seen.has(next)) { seen.add(next); queue.push([...path, next]); }
    }
  }
  return ok(null); // no path
}

/** (13) Consensus across multiple validations: replication-weighted mean confidence
 * + agreement (fraction within 0.15 of the mean). Real cross-validation aggregation. */
export async function consensus(validationIds: string[]): Promise<Result<{ n: number; meanConfidence: number; agreement: number }>> {
  if (!Array.isArray(validationIds) || validationIds.length === 0) return err("no_validations", "consensus: provide ≥1 validationId");
  const recs = [];
  for (const id of validationIds) {
    const r = await validation.assess(id);
    if (!r.isOk) return err("unknown_validation", `consensus: '${id}' not found`);
    recs.push(r.data);
  }
  const wsum = recs.reduce((s, r) => s + (r.replicationCount + 1), 0);
  const mean = recs.reduce((s, r) => s + r.confidence * (r.replicationCount + 1), 0) / wsum;
  const within = recs.filter((r) => Math.abs(r.confidence - mean) <= 0.15).length;
  return ok({ n: recs.length, meanConfidence: Math.round(mean * 1000) / 1000, agreement: Math.round((within / recs.length) * 1000) / 1000 });
}

/** (14) Seal a federation evidence bundle (sha256) + verify it (tamper detection). */
export async function sealEvidenceBundle(): Promise<Result<{ bundle: unknown; seal: string }>> {
  const r = await federationReport();
  if (!r.isOk) return r as Err;
  const bundle = r.data;
  const seal = createHash("sha256").update(JSON.stringify(bundle)).digest("hex");
  return ok({ bundle, seal });
}
export function verifyBundleSeal(bundle: unknown, seal: string): Result<{ intact: boolean }> {
  const recomputed = createHash("sha256").update(JSON.stringify(bundle)).digest("hex");
  return ok({ intact: recomputed === seal });
}

/** (15) Lineage critical path: ordered hops with elapsed deltas + total duration. */
export function lineageCriticalPath(eventId: string): Result<{ hops: number; totalMs: number; order: string[] }> {
  const lin = observability.getLineage(eventId);
  if (!lin.isOk) return lin as Err;
  const chain = [...lin.data.chain].sort((a, b) => a.ts - b.ts);
  const totalMs = chain.length ? chain[chain.length - 1].ts - chain[0].ts : 0;
  return ok({ hops: chain.length, totalMs, order: chain.map((c) => c.runtime) });
}

/** (16) Composite release readiness: ALL runtimes ready AND release policies pass.
 * Fail-closed — either condition failing blocks. */
export function federationReadiness(ctx: Record<string, unknown>): Result<{ ready: boolean; degraded: string[]; decision: "allow" | "block" }> {
  const deg = detectDegraded();
  const pol = enforceReleaseReadiness(ctx);
  if (!deg.isOk) return deg as Err;
  if (!pol.isOk) return pol as Err;
  const ready = deg.data.ready && pol.data.decision === "allow";
  return ok({ ready, degraded: deg.data.degraded, decision: pol.data.decision });
}

// ── KG graph analytics (real algorithms over runtime-knowledge-graph edges) ────
async function edgeList(): Promise<Array<{ from: string; to: string }>> {
  const all = await kg.query({});
  return all.isOk ? all.data.map((e) => ({ from: e.from, to: e.to })) : [];
}

/** (17) Subgraph: BFS from a seed up to depth k → reachable nodes + spanned edges. */
export async function subgraph(seed: string, depth: number): Promise<Result<{ nodes: string[]; edges: number }>> {
  if (!seed) return err("invalid_seed", "subgraph: seed required");
  const edges = await edgeList();
  const adj = new Map<string, string[]>();
  for (const e of edges) { (adj.get(e.from) ?? adj.set(e.from, []).get(e.from))!.push(e.to); }
  const seen = new Set([seed]);
  let frontier = [seed];
  let spanned = 0;
  for (let d = 0; d < Math.max(0, depth); d++) {
    const next: string[] = [];
    for (const n of frontier) for (const m of adj.get(n) || []) { spanned++; if (!seen.has(m)) { seen.add(m); next.push(m); } }
    frontier = next;
    if (!frontier.length) break;
  }
  return ok({ nodes: [...seen], edges: spanned });
}

/** (18) Cycle detection over the directed KG (DFS three-colour). */
export async function hasCycle(): Promise<Result<{ cyclic: boolean }>> {
  const edges = await edgeList();
  const adj = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const e of edges) { nodes.add(e.from); nodes.add(e.to); (adj.get(e.from) ?? adj.set(e.from, []).get(e.from))!.push(e.to); }
  const color = new Map<string, number>(); // 0=white,1=grey,2=black
  const dfs = (n: string): boolean => {
    color.set(n, 1);
    for (const m of adj.get(n) || []) {
      const c = color.get(m) ?? 0;
      if (c === 1) return true;
      if (c === 0 && dfs(m)) return true;
    }
    color.set(n, 2);
    return false;
  };
  for (const n of nodes) if ((color.get(n) ?? 0) === 0 && dfs(n)) return ok({ cyclic: true });
  return ok({ cyclic: false });
}

/** (19) Degree centrality: in/out degree per node, top-N by total. */
export async function degreeCentrality(topN = 5): Promise<Result<{ top: Array<{ id: string; in: number; out: number; total: number }> }>> {
  const edges = await edgeList();
  const deg = new Map<string, { in: number; out: number }>();
  const bump = (id: string, k: "in" | "out") => { const d = deg.get(id) ?? { in: 0, out: 0 }; d[k]++; deg.set(id, d); };
  for (const e of edges) { bump(e.from, "out"); bump(e.to, "in"); }
  const top = [...deg.entries()].map(([id, d]) => ({ id, in: d.in, out: d.out, total: d.in + d.out }))
    .sort((a, b) => b.total - a.total).slice(0, topN);
  return ok({ top });
}

/** (20) Weakly-connected components (edges treated as undirected). */
export async function connectedComponents(): Promise<Result<{ count: number; sizes: number[] }>> {
  const edges = await edgeList();
  const parent = new Map<string, string>();
  const find = (x: string): string => { parent.set(x, parent.get(x) ?? x); if (parent.get(x) === x) return x; const r = find(parent.get(x)!); parent.set(x, r); return r; };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
  const nodes = new Set<string>();
  for (const e of edges) { nodes.add(e.from); nodes.add(e.to); find(e.from); find(e.to); union(e.from, e.to); }
  const sizes = new Map<string, number>();
  for (const n of nodes) { const r = find(n); sizes.set(r, (sizes.get(r) ?? 0) + 1); }
  return ok({ count: sizes.size, sizes: [...sizes.values()].sort((a, b) => b - a) });
}

/** (21) Topological order (Kahn). Fail-closed if the graph is cyclic. */
export async function topoOrder(): Promise<Result<{ order: string[] }>> {
  const edges = await edgeList();
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  const nodes = new Set<string>();
  for (const e of edges) { nodes.add(e.from); nodes.add(e.to); (adj.get(e.from) ?? adj.set(e.from, []).get(e.from))!.push(e.to); indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1); indeg.set(e.from, indeg.get(e.from) ?? 0); }
  const queue = [...nodes].filter((n) => (indeg.get(n) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const m of adj.get(n) || []) { indeg.set(m, indeg.get(m)! - 1); if (indeg.get(m) === 0) queue.push(m); }
  }
  if (order.length !== nodes.size) return err("cyclic", "topoOrder: graph is cyclic — no topological order");
  return ok({ order });
}
