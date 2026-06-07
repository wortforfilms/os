/*
 * @maataa/runtime-knowledge-graph
 * Minimal but REAL in-memory knowledge-graph runtime.
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.2
 *
 * Honest scope: this is the in-memory tier. Operations genuinely execute and are
 * validated fail-closed (unknown types / dangling edges are rejected). It is NOT
 * persistent and NOT production-GO — __meta.governedProductionGo stays false. The
 * runtime reports status "ready" because the in-memory store is operational.
 */
import RuntimePersistence from "../../runtime-persistence/src/index.ts";

const RUNTIME = "runtime-knowledge-graph";
const VERSION = "0.1.0-alpha.1";

// ---- Result envelope ------------------------------------------------------
export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;

const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

// ---- Contract types -------------------------------------------------------
export type EntityTypeSpec = { name: string; schema: Record<string, string> };
export type EntityId    = string;
export type EdgeId      = string;
export type EvidenceRef = { source: "runtime-hkd-registry" | "runtime-validation"; id: string };
export type GraphPattern = { from?: EntityId; type?: string; to?: EntityId };
export type Match       = { from: EntityId; type: string; to: EntityId; evidenceRef: EvidenceRef | null };

// ---- In-memory store ------------------------------------------------------
type StoredEntity = { id: EntityId; typeId: string; payload: unknown };
type StoredEdge = { edgeId: EdgeId; from: EntityId; type: string; to: EntityId; evidenceRef: EvidenceRef | null };

const entityTypes = new Map<string, EntityTypeSpec>();
const entities = new Map<EntityId, StoredEntity>();
const edges: StoredEdge[] = [];
let seq = 0;
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };
const nextId = (prefix: string) => `${prefix}-${(++seq).toString(36)}`;

// SQLite persistence layer
const persistence = new RuntimePersistence(RUNTIME);

// Restore from persistence
function restoreFromPersistence(): void {
  const storedTypes = persistence.load("entityTypes");
  if (storedTypes.ok && Array.isArray(storedTypes.value)) {
    for (const t of storedTypes.value as EntityTypeSpec[]) {
      if (t.name) entityTypes.set(`type:${t.name}`, t);
    }
  }
  const storedEntities = persistence.load("entities");
  if (storedEntities.ok && Array.isArray(storedEntities.value)) {
    for (const e of storedEntities.value as StoredEntity[]) {
      if (e.id) entities.set(e.id, e);
    }
  }
  const storedEdges = persistence.load("edges");
  if (storedEdges.ok && Array.isArray(storedEdges.value)) {
    edges.push(...(storedEdges.value as StoredEdge[]));
  }
}

// Persist state
function persistState(): void {
  persistence.persist("entityTypes", Array.from(entityTypes.values()));
  persistence.persist("entities", Array.from(entities.values()));
  persistence.persist("edges", edges);
}

// Initialize on module load
restoreFromPersistence();

/** Reset the in-memory store. Test/operational helper. */
export function reset(): void {
  entityTypes.clear();
  entities.clear();
  edges.length = 0;
  seq = 0;
  lastEventTs = null;
  persistence.clear();
}

// ---- Facade ---------------------------------------------------------------
export async function defineEntityType(spec: EntityTypeSpec): Promise<Result<{ typeId: string }>> {
  if (!spec || typeof spec.name !== "string" || spec.name.trim() === "") {
    return err("invalid_spec", "defineEntityType: spec.name is required");
  }
  if (!spec.schema || typeof spec.schema !== "object") {
    return err("invalid_spec", "defineEntityType: spec.schema must be an object");
  }
  const typeId = `type:${spec.name}`;
  entityTypes.set(typeId, { name: spec.name, schema: { ...spec.schema } });
  touch();
  persistState(); // Persist after changes
  return ok({ typeId });
}

export async function addEntity(typeId: string, payload: unknown): Promise<Result<{ id: EntityId }>> {
  if (!entityTypes.has(typeId)) {
    return err("unknown_type", `addEntity: entity type '${typeId}' is not defined`);
  }
  const id = nextId("ent");
  entities.set(id, { id, typeId, payload });
  touch();
  persistState(); // Persist after changes
  return ok({ id });
}

export async function addRelation(
  from: EntityId,
  type: string,
  to: EntityId,
  evidenceRef?: EvidenceRef
): Promise<Result<{ edgeId: EdgeId }>> {
  if (typeof type !== "string" || type.trim() === "") {
    return err("invalid_relation", "addRelation: relation type is required");
  }
  if (!entities.has(from)) return err("dangling_edge", `addRelation: 'from' entity '${from}' does not exist`);
  if (!entities.has(to)) return err("dangling_edge", `addRelation: 'to' entity '${to}' does not exist`);
  const edgeId = nextId("edge");
  edges.push({ edgeId, from, type, to, evidenceRef: evidenceRef ?? null });
  touch();
  persistState(); // Persist after changes
  return ok({ edgeId });
}

export async function query(pattern: GraphPattern): Promise<Result<Match[]>> {
  const p = pattern ?? {};
  const matches: Match[] = edges
    .filter((e) => (p.from === undefined || e.from === p.from)
      && (p.type === undefined || e.type === p.type)
      && (p.to === undefined || e.to === p.to))
    .map((e) => ({ from: e.from, type: e.type, to: e.to, evidenceRef: e.evidenceRef }));
  return ok(matches);
}

// ---- Observable surface ---------------------------------------------------
export type HealthReport = {
  runtime: string;
  version: string;
  status: "scaffold" | "degraded" | "ready";
  initialized: boolean;
  capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; notes: string[]; entityTypes: number; entities: number; edges: number; persistence: ReturnType<RuntimePersistence["health"]> };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME,
    version: VERSION,
    status: "ready",
    initialized: true,
    capabilities: ["defineEntityType", "addEntity", "addRelation", "query"],
    evidence: {
      pendingOps: 0,
      lastEventTs,
      entityTypes: entityTypes.size,
      entities: entities.size,
      edges: edges.length,
      persistence: persistence.health(),
      notes: [
        "in-memory tier: operations execute and are validated fail-closed",
        "state persisted to SQLite via runtime-persistence",
        "NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
