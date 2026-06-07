/*
 * @maataa/runtime-spatial
 * Minimal but REAL in-process 2-D spatial index (exact, brute-force).
 *
 * Honest scope: real point storage with exact range / nearest / radius queries.
 * In-memory tier — NOT a distributed geospatial DB and NOT any fabricated scale.
 * governedProductionGo stays false. Fail-closed.
 */
const RUNTIME = "runtime-spatial";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type Point = { id: string; x: number; y: number };
const points = new Map<string, Point>();
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export function reset(): void { points.clear(); lastEventTs = null; }

/** (1) Insert/update a point. Fail-closed on non-finite coordinates. */
export function insert(id: string, x: number, y: number): Result<{ count: number }> {
  if (!id || typeof id !== "string") return err("invalid_id", "insert: id required");
  if (!Number.isFinite(x) || !Number.isFinite(y)) return err("invalid_coords", "insert: x and y must be finite");
  points.set(id, { id, x, y });
  touch();
  return ok({ count: points.size });
}

/** (2) Remove a point. Fail-closed on unknown id. */
export function remove(id: string): Result<{ count: number }> {
  if (!points.has(id)) return err("unknown_point", `remove: '${id}' not found`);
  points.delete(id);
  touch();
  return ok({ count: points.size });
}

/** (3) Range query: points inside an axis-aligned bounding box (inclusive). */
export function rangeQuery(minX: number, minY: number, maxX: number, maxY: number): Result<{ points: Point[] }> {
  if ([minX, minY, maxX, maxY].some((n) => !Number.isFinite(n))) return err("invalid_bbox", "rangeQuery: bbox must be finite");
  const hits = [...points.values()].filter((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
  return ok({ points: hits });
}

/** (4) Nearest single point to (x,y) by Euclidean distance. Fail-closed if empty. */
export function nearest(x: number, y: number): Result<{ point: Point; distance: number }> {
  if (points.size === 0) return err("empty_index", "nearest: index is empty");
  let best: Point | null = null;
  let bestD = Infinity;
  for (const p of points.values()) { const d = dist(p, { x, y }); if (d < bestD) { bestD = d; best = p; } }
  return ok({ point: best!, distance: Math.round(bestD * 1000) / 1000 });
}

/** (5) k nearest neighbours, sorted by distance. */
export function knn(x: number, y: number, k: number): Result<{ points: Array<Point & { distance: number }> }> {
  if (!Number.isInteger(k) || k < 1) return err("invalid_k", "knn: k must be a positive integer");
  const ranked = [...points.values()]
    .map((p) => ({ ...p, distance: Math.round(dist(p, { x, y }) * 1000) / 1000 }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
  return ok({ points: ranked });
}

/** (6) Points within a radius r of (x,y). */
export function withinRadius(x: number, y: number, r: number): Result<{ points: Point[] }> {
  if (!Number.isFinite(r) || r < 0) return err("invalid_radius", "withinRadius: r must be ≥ 0");
  const hits = [...points.values()].filter((p) => dist(p, { x, y }) <= r);
  return ok({ points: hits });
}

/** (7) Bounding box of all points. Fail-closed if empty. */
export function bounds(): Result<{ minX: number; minY: number; maxX: number; maxY: number }> {
  if (points.size === 0) return err("empty_index", "bounds: index is empty");
  const xs = [...points.values()].map((p) => p.x);
  const ys = [...points.values()].map((p) => p.y);
  return ok({ minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; pointCount: number; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["insert", "remove", "rangeQuery", "nearest", "knn", "withinRadius", "bounds"],
    evidence: {
      pendingOps: 0, lastEventTs, pointCount: points.size,
      notes: [
        "in-process tier: exact 2-D point index with real range/nearest/radius queries",
        "NOT a distributed geospatial DB; counts are the real values; NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
