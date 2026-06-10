// Knowledge-graph relation taxonomy (knowledge-graph universe).
//
// PHKD: a REAL, validated taxonomy — the 13 relation types named on the board,
// each with explicit semantics (directionality, inverse, category) and runtime
// validators that fail closed. This is distinct from kbs-runtime's KbsEdgeType
// (the KBS *evidence* edge set: CITES/SUPPORTS/…); that set is untouched.

export const KG_RELATION_TYPES = [
  "IS_A",
  "PART_OF",
  "RELATED_TO",
  "CAUSED_BY",
  "DEPENDS_ON",
  "CREATED_BY",
  "USES",
  "MENTIONS",
  "LOCATED_IN",
  "OWNS",
  "INVESTS_IN",
  "TEACHES",
  "LEARNED_FROM",
] as const;

export type KgRelationType = (typeof KG_RELATION_TYPES)[number];

export type KgRelationCategory =
  | "taxonomy"
  | "composition"
  | "association"
  | "causal"
  | "dependency"
  | "provenance"
  | "usage"
  | "reference"
  | "spatial"
  | "ownership"
  | "economic"
  | "pedagogic";

export interface RelationTypeSpec {
  type: KgRelationType;
  description: string;
  category: KgRelationCategory;
  /** Whether direction is meaningful (from→to). RELATED_TO is symmetric. */
  directed: boolean;
  /** True when (a,b) implies (b,a) of the same type. */
  symmetric: boolean;
  /** The inverse relation within this set, if one exists (else null). */
  inverse: KgRelationType | null;
}

export const RELATION_TYPE_SPECS: Record<KgRelationType, RelationTypeSpec> = {
  IS_A:        { type: "IS_A",        description: "Subject is a kind/subtype of object",         category: "taxonomy",    directed: true,  symmetric: false, inverse: null },
  PART_OF:     { type: "PART_OF",     description: "Subject is a component of object",            category: "composition", directed: true,  symmetric: false, inverse: null },
  RELATED_TO:  { type: "RELATED_TO",  description: "Subject is associated with object (symmetric)", category: "association", directed: false, symmetric: true,  inverse: "RELATED_TO" },
  CAUSED_BY:   { type: "CAUSED_BY",   description: "Subject is an effect of object",              category: "causal",      directed: true,  symmetric: false, inverse: null },
  DEPENDS_ON:  { type: "DEPENDS_ON",  description: "Subject requires object to function",         category: "dependency",  directed: true,  symmetric: false, inverse: null },
  CREATED_BY:  { type: "CREATED_BY",  description: "Subject was produced by object",              category: "provenance",  directed: true,  symmetric: false, inverse: null },
  USES:        { type: "USES",        description: "Subject makes use of object",                 category: "usage",       directed: true,  symmetric: false, inverse: null },
  MENTIONS:    { type: "MENTIONS",    description: "Subject references object",                    category: "reference",   directed: true,  symmetric: false, inverse: null },
  LOCATED_IN:  { type: "LOCATED_IN",  description: "Subject is situated within object",           category: "spatial",     directed: true,  symmetric: false, inverse: null },
  OWNS:        { type: "OWNS",        description: "Subject holds ownership of object",           category: "ownership",   directed: true,  symmetric: false, inverse: null },
  INVESTS_IN:  { type: "INVESTS_IN",  description: "Subject allocates capital to object",         category: "economic",    directed: true,  symmetric: false, inverse: null },
  TEACHES:     { type: "TEACHES",     description: "Subject imparts knowledge to object",         category: "pedagogic",   directed: true,  symmetric: false, inverse: "LEARNED_FROM" },
  LEARNED_FROM:{ type: "LEARNED_FROM",description: "Subject acquired knowledge from object",      category: "pedagogic",   directed: true,  symmetric: false, inverse: "TEACHES" },
};

const SPEC_SET = new Set<string>(KG_RELATION_TYPES);

/** Type guard — fail-closed membership test. */
export function isKgRelationType(value: unknown): value is KgRelationType {
  return typeof value === "string" && SPEC_SET.has(value);
}

export function getRelationSpec(type: KgRelationType): RelationTypeSpec {
  return RELATION_TYPE_SPECS[type];
}

/** Throws on an unknown relation type (fail closed). */
export function assertRelationType(value: unknown): KgRelationType {
  if (!isKgRelationType(value)) {
    throw new Error(`unknown KG relation type '${String(value)}' (fail closed)`);
  }
  return value;
}

export function inverseOf(type: KgRelationType): KgRelationType | null {
  return RELATION_TYPE_SPECS[type].inverse;
}

export interface RelationEdge {
  from: string;
  to: string;
  type: KgRelationType;
}

export interface RelationValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a relation edge against the taxonomy. Fail-closed:
 *  - type must be one of the 13
 *  - from/to must be non-empty
 *  - no self-relations (from !== to)
 */
export function validateRelationEdge(edge: { from?: unknown; to?: unknown; type?: unknown }): RelationValidation {
  const errors: string[] = [];
  if (!isKgRelationType(edge.type)) errors.push(`invalid relation type: ${String(edge.type)}`);
  if (typeof edge.from !== "string" || edge.from.trim() === "") errors.push("missing 'from'");
  if (typeof edge.to !== "string" || edge.to.trim() === "") errors.push("missing 'to'");
  if (typeof edge.from === "string" && edge.from === edge.to) errors.push("self-relation not allowed (from === to)");
  return { valid: errors.length === 0, errors };
}

/** Normalize a symmetric edge to a canonical orientation (deterministic). */
export function canonicalizeEdge(edge: RelationEdge): RelationEdge {
  const spec = RELATION_TYPE_SPECS[edge.type];
  if (spec.symmetric && edge.from > edge.to) {
    return { from: edge.to, to: edge.from, type: edge.type };
  }
  return edge;
}
