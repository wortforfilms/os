import {
  KG_RELATION_TYPES,
  RELATION_TYPE_SPECS,
  canonicalizeEdge,
  getRelationSpec,
  inverseOf,
  isKgRelationType,
  validateRelationEdge,
  type KgRelationType,
  type RelationTypeSpec,
} from "./relation-types.ts";

export type RelationMetadata = Record<string, unknown>;

export interface StoredRelationEdge {
  id: string;
  from: string;
  to: string;
  type: KgRelationType;
  createdAt: string;
  metadata: RelationMetadata;
}

export interface RelationEdgeInput {
  id: string;
  from: string;
  to: string;
  type: KgRelationType;
  createdAt: string;
  metadata?: RelationMetadata;
}

export interface RelationStoreError {
  code:
    | "duplicate_edge"
    | "duplicate_id"
    | "edge_not_found"
    | "invalid_edge"
    | "invalid_metadata"
    | "invalid_traversal";
  message: string;
  details?: unknown;
}

export type RelationStoreResult<T> =
  | { isOk: true; data: T; error: null }
  | { isOk: false; data: null; error: RelationStoreError };

export type TraversalDirection = "outgoing" | "incoming" | "both";

export interface TraverseOptions {
  maxDepth?: number;
  direction?: TraversalDirection;
  type?: KgRelationType;
}

export interface TraversalResult {
  startNodeId: string;
  maxDepth: number;
  direction: TraversalDirection;
  type: KgRelationType | null;
  visitedNodes: string[];
  traversedEdgeIds: string[];
}

export interface EdgeExplanation {
  edge: StoredRelationEdge;
  relation: RelationTypeSpec;
  inverseType: KgRelationType | null;
  inverseEdges: StoredRelationEdge[];
  canonicalKey: string;
  storage: "local/in-memory";
  graphDatabase: false;
  productionReady: false;
  reasoningEngine: false;
}

const ok = <T>(data: T): RelationStoreResult<T> => ({ isOk: true, data, error: null });

const fail = <T>(
  code: RelationStoreError["code"],
  message: string,
  details?: unknown,
): RelationStoreResult<T> => ({ isOk: false, data: null, error: { code, message, details } });

const compareEdges = (a: StoredRelationEdge, b: StoredRelationEdge): number =>
  a.type.localeCompare(b.type) ||
  a.from.localeCompare(b.from) ||
  a.to.localeCompare(b.to) ||
  a.id.localeCompare(b.id);

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
};

const normalizeMetadata = (metadata: unknown): RelationStoreResult<RelationMetadata> => {
  if (metadata === undefined) return ok({});
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return fail("invalid_metadata", "metadata must be an object when provided");
  }
  try {
    stableStringify(metadata);
  } catch (error) {
    return fail("invalid_metadata", "metadata must be JSON-like and deterministic", String(error));
  }
  return ok({ ...(metadata as RelationMetadata) });
};

const canonicalKeyFor = (edge: Pick<StoredRelationEdge, "from" | "to" | "type">): string =>
  `${edge.type}\u0000${edge.from}\u0000${edge.to}`;

const cleanNodeId = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export class KgRelationStore {
  readonly storage = "local/in-memory" as const;
  readonly graphDatabase = false;
  readonly productionReady = false;
  readonly reasoningEngine = false;

  private readonly edgesById = new Map<string, StoredRelationEdge>();
  private readonly canonicalIndex = new Map<string, Set<string>>();

  constructor(edges: RelationEdgeInput[] = []) {
    for (const edge of edges) {
      const result = this.addEdge(edge);
      if (!result.isOk) {
        throw new Error(`invalid seed edge '${edge.id}': ${result.error.message}`);
      }
    }
  }

  addEdge(edge: RelationEdgeInput): RelationStoreResult<StoredRelationEdge> {
    if (typeof edge.id !== "string" || edge.id.trim() === "") {
      return fail("invalid_edge", "edge id is required");
    }
    if (this.edgesById.has(edge.id)) {
      return fail("duplicate_id", `edge id '${edge.id}' already exists`);
    }
    if (typeof edge.createdAt !== "string" || edge.createdAt.trim() === "") {
      return fail("invalid_edge", "createdAt is required");
    }
    if (!isKgRelationType(edge.type)) {
      return fail("invalid_edge", `unknown KG relation type '${String(edge.type)}'`);
    }

    const metadata = normalizeMetadata(edge.metadata);
    if (!metadata.isOk) return metadata;

    const relationEdge = canonicalizeEdge({
      from: cleanNodeId(edge.from),
      to: cleanNodeId(edge.to),
      type: edge.type,
    });
    const validation = validateRelationEdge(relationEdge);
    if (!validation.valid) {
      return fail("invalid_edge", "relation edge failed validation", validation.errors);
    }

    const stored: StoredRelationEdge = {
      id: edge.id.trim(),
      from: relationEdge.from,
      to: relationEdge.to,
      type: relationEdge.type,
      createdAt: edge.createdAt.trim(),
      metadata: metadata.data,
    };

    const canonicalKey = canonicalKeyFor(stored);
    const existingIds = this.canonicalIndex.get(canonicalKey) ?? new Set<string>();
    if (existingIds.size > 0) {
      const metadataHash = stableStringify(stored.metadata);
      const sameMetadata = [...existingIds].some((id) => {
        const existing = this.edgesById.get(id);
        return existing ? stableStringify(existing.metadata) === metadataHash : false;
      });
      if (sameMetadata) {
        return fail("duplicate_edge", "duplicate canonical edge with identical metadata is not allowed");
      }
      if (stored.metadata.allowDuplicate !== true) {
        return fail(
          "duplicate_edge",
          "duplicate canonical edge requires metadata.allowDuplicate=true and distinct metadata",
        );
      }
    }

    this.edgesById.set(stored.id, stored);
    existingIds.add(stored.id);
    this.canonicalIndex.set(canonicalKey, existingIds);
    return ok({ ...stored, metadata: { ...stored.metadata } });
  }

  removeEdge(id: string): RelationStoreResult<StoredRelationEdge> {
    const edge = this.edgesById.get(id);
    if (!edge) return fail("edge_not_found", `edge '${id}' was not found`);

    this.edgesById.delete(id);
    const canonicalKey = canonicalKeyFor(edge);
    const ids = this.canonicalIndex.get(canonicalKey);
    if (ids) {
      ids.delete(id);
      if (ids.size === 0) this.canonicalIndex.delete(canonicalKey);
    }
    return ok({ ...edge, metadata: { ...edge.metadata } });
  }

  listEdges(): StoredRelationEdge[] {
    return [...this.edgesById.values()].sort(compareEdges).map(cloneEdge);
  }

  findOutgoing(nodeId: string, type?: KgRelationType): StoredRelationEdge[] {
    const node = cleanNodeId(nodeId);
    if (!node || !validOptionalType(type)) return [];
    return this.listEdges().filter((edge) => edge.from === node && (!type || edge.type === type));
  }

  findIncoming(nodeId: string, type?: KgRelationType): StoredRelationEdge[] {
    const node = cleanNodeId(nodeId);
    if (!node || !validOptionalType(type)) return [];
    return this.listEdges().filter((edge) => edge.to === node && (!type || edge.type === type));
  }

  findBetween(from: string, to: string, type?: KgRelationType): StoredRelationEdge[] {
    const source = cleanNodeId(from);
    const target = cleanNodeId(to);
    if (!source || !target || !validOptionalType(type)) return [];

    return this.listEdges().filter((edge) => {
      if (type && edge.type !== type) return false;
      const spec = RELATION_TYPE_SPECS[edge.type];
      if (spec.symmetric) {
        const canonical = canonicalizeEdge({ from: source, to: target, type: edge.type });
        return edge.from === canonical.from && edge.to === canonical.to;
      }
      return edge.from === source && edge.to === target;
    });
  }

  neighbors(nodeId: string, type?: KgRelationType): string[] {
    const node = cleanNodeId(nodeId);
    if (!node || !validOptionalType(type)) return [];

    const neighbors = new Set<string>();
    for (const edge of this.listEdges()) {
      if (type && edge.type !== type) continue;
      if (edge.from === node) neighbors.add(edge.to);
      if (edge.to === node) neighbors.add(edge.from);
    }
    return [...neighbors].sort((a, b) => a.localeCompare(b));
  }

  inverseEdges(edge: StoredRelationEdge | RelationEdgeInput): RelationStoreResult<StoredRelationEdge[]> {
    if (!isKgRelationType(edge.type)) {
      return fail("invalid_edge", `unknown KG relation type '${String(edge.type)}'`);
    }
    const validation = validateRelationEdge(edge);
    if (!validation.valid) {
      return fail("invalid_edge", "relation edge failed validation", validation.errors);
    }

    const inverseType = inverseOf(edge.type);
    if (!inverseType) return ok([]);

    const inverse = canonicalizeEdge({
      from: cleanNodeId(edge.to),
      to: cleanNodeId(edge.from),
      type: inverseType,
    });
    const metadata = normalizeMetadata(edge.metadata);
    if (!metadata.isOk) return metadata;

    return ok([
      {
        id: `${edge.id}:inverse`,
        from: inverse.from,
        to: inverse.to,
        type: inverse.type,
        createdAt: edge.createdAt,
        metadata: { ...metadata.data, inferredInverse: true },
      },
    ]);
  }

  explainEdge(edgeId: string): RelationStoreResult<EdgeExplanation> {
    const edge = this.edgesById.get(edgeId);
    if (!edge) return fail("edge_not_found", `edge '${edgeId}' was not found`);
    const inverse = this.inverseEdges(edge);
    if (!inverse.isOk) return inverse;
    return ok({
      edge: cloneEdge(edge),
      relation: getRelationSpec(edge.type),
      inverseType: inverseOf(edge.type),
      inverseEdges: inverse.data.map(cloneEdge),
      canonicalKey: canonicalKeyFor(edge),
      storage: this.storage,
      graphDatabase: this.graphDatabase,
      productionReady: this.productionReady,
      reasoningEngine: this.reasoningEngine,
    });
  }

  traverse(startNodeId: string, options: TraverseOptions = {}): RelationStoreResult<TraversalResult> {
    const start = cleanNodeId(startNodeId);
    if (!start) return fail("invalid_traversal", "startNodeId is required");

    const maxDepth = options.maxDepth ?? 1;
    const direction = options.direction ?? "outgoing";
    const type = options.type ?? null;
    if (!Number.isInteger(maxDepth) || maxDepth < 0) {
      return fail("invalid_traversal", "maxDepth must be a non-negative integer");
    }
    if (!["outgoing", "incoming", "both"].includes(direction)) {
      return fail("invalid_traversal", "direction must be outgoing, incoming, or both");
    }
    if (type !== null && !isKgRelationType(type)) {
      return fail("invalid_traversal", `unknown KG relation type '${String(type)}'`);
    }

    const visited = new Set<string>([start]);
    const traversed = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: start, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.depth >= maxDepth) continue;

      for (const step of this.traversalSteps(current.nodeId, direction, type)) {
        traversed.add(step.edge.id);
        if (!visited.has(step.nextNodeId)) {
          visited.add(step.nextNodeId);
          queue.push({ nodeId: step.nextNodeId, depth: current.depth + 1 });
        }
      }
    }

    return ok({
      startNodeId: start,
      maxDepth,
      direction,
      type,
      visitedNodes: [...visited].sort((a, b) => a.localeCompare(b)),
      traversedEdgeIds: [...traversed].sort((a, b) => a.localeCompare(b)),
    });
  }

  findDependencies(nodeId: string): StoredRelationEdge[] {
    return this.findOutgoing(nodeId, "DEPENDS_ON");
  }

  findParts(nodeId: string): StoredRelationEdge[] {
    return this.findIncoming(nodeId, "PART_OF");
  }

  findOwners(nodeId: string): StoredRelationEdge[] {
    return this.findIncoming(nodeId, "OWNS");
  }

  findLearningLineage(nodeId: string): StoredRelationEdge[] {
    return this.listEdges().filter(
      (edge) =>
        (edge.type === "TEACHES" || edge.type === "LEARNED_FROM") &&
        (edge.from === nodeId || edge.to === nodeId),
    );
  }

  findInvestmentLinks(nodeId: string): StoredRelationEdge[] {
    return this.listEdges().filter(
      (edge) => edge.type === "INVESTS_IN" && (edge.from === nodeId || edge.to === nodeId),
    );
  }

  private traversalSteps(
    nodeId: string,
    direction: TraversalDirection,
    type: KgRelationType | null,
  ): Array<{ edge: StoredRelationEdge; nextNodeId: string }> {
    const steps: Array<{ edge: StoredRelationEdge; nextNodeId: string }> = [];
    for (const edge of this.listEdges()) {
      if (type && edge.type !== type) continue;
      if ((direction === "outgoing" || direction === "both") && edge.from === nodeId) {
        steps.push({ edge, nextNodeId: edge.to });
      }
      if ((direction === "incoming" || direction === "both") && edge.to === nodeId) {
        steps.push({ edge, nextNodeId: edge.from });
      }
    }
    return steps.sort((a, b) => compareEdges(a.edge, b.edge) || a.nextNodeId.localeCompare(b.nextNodeId));
  }
}

export function createRelationStore(edges: RelationEdgeInput[] = []): KgRelationStore {
  return new KgRelationStore(edges);
}

export const KBS_GRAPH_RELATION_STORE_EVIDENCE = Object.freeze({
  relationTypesTotal: KG_RELATION_TYPES.length,
  storage: "local/in-memory",
  graphDatabase: false,
  productionReady: false,
  traversalImplemented: true,
  reasoningEngine: false,
});

const cloneEdge = (edge: StoredRelationEdge): StoredRelationEdge => ({
  ...edge,
  metadata: { ...edge.metadata },
});

const validOptionalType = (type: KgRelationType | undefined): boolean =>
  type === undefined || isKgRelationType(type);
