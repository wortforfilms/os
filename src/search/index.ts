import productMatrix from "../../data/product-surface-matrix.json" with { type: "json" };
import hardeningMatrix from "../../release/reports/PRODUCTION_HARDENING_MATRIX.json" with { type: "json" };

const RUNTIME_STATES = [
  "EXPERIMENTAL",
  "STAGED",
  "PREVIEW_VERIFIED",
  "CONTROLLED_GO",
  "CONTROLLED_NO_GO",
  "BLOCKED",
  "DEPRECATED",
] as const;

type RuntimeState = (typeof RUNTIME_STATES)[number];

export type SearchResultType = "route" | "feature" | "state" | "doc" | "evidence" | "package" | "app" | "crate" | "blocker";

export type SearchResult = {
  id: string;
  title: string;
  type: SearchResultType;
  path: string;
  status: RuntimeState | "PASS" | "BLOCKED";
  description: string;
  tags: string[];
};

export type SearchFilters = {
  type?: SearchResultType | "all";
  status?: string | "all";
};

const implementedRoutes = new Set(["/", "/dashboard", "/auth/login", "/auth/signup", "/admin", "/domains", "/docs", "/settings", "/search"]);

const docs = [
  "docs/getting-started.md",
  "docs/architecture.md",
  "docs/runtime-states.md",
  "docs/observatory.md",
  "docs/runtime-transport.md",
  "docs/search.md",
  "docs/api.md",
  "docs/offline-mode.md",
  "docs/deployment.md",
  "docs/rollback.md",
  "docs/no-hallucination-policy.md",
  "docs/commercialization.md",
];

const surfaces = {
  app: ["apps/system", "apps/electron", "apps/maataa", "apps/tlp", "apps/pedagogy"],
  package: ["packages/maataa-ui", "packages/evidence-runtime", "packages/universal-runtime"],
  crate: ["crates/hemant-core", "src/kernel.rs", "src/ipc", "src/storage"],
};

export function buildUnifiedSearchIndex(): SearchResult[] {
  const routeResults = productMatrix.routes.map((route) => ({
    id: `route:${route.path}`,
    title: route.path === "/" ? "Home" : route.path,
    type: "route" as const,
    path: route.path,
    status: route.state as RuntimeState,
    description: route.evidence,
    tags: ["route", route.state.toLowerCase(), implementedRoutes.has(route.path) ? "implemented" : "blocked-preview"],
  }));

  const featureResults = productMatrix.features.map((feature) => ({
    id: `feature:${feature.id}`,
    title: feature.id,
    type: "feature" as const,
    path: "data/product-surface-matrix.json",
    status: feature.state as RuntimeState,
    description: feature.evidence,
    tags: ["feature", feature.state.toLowerCase()],
  }));

  const stateResults = RUNTIME_STATES.map((state) => ({
    id: `state:${state}`,
    title: state,
    type: "state" as const,
    path: "packages/universal-runtime/src/runtime-states.ts",
    status: state,
    description: `Canonical runtime state ${state}.`,
    tags: ["runtime-state", state.toLowerCase()],
  }));

  const docResults = docs.map((path) => ({
    id: `doc:${path}`,
    title: path.replace("docs/", "").replace(".md", ""),
    type: "doc" as const,
    path,
    status: "PREVIEW_VERIFIED" as const,
    description: `Repository documentation file: ${path}.`,
    tags: ["docs", "local"],
  }));

  const surfaceResults = Object.entries(surfaces).flatMap(([type, paths]) =>
    paths.map((path) => ({
      id: `${type}:${path}`,
      title: path,
      type: type as "app" | "package" | "crate",
      path,
      status: "PREVIEW_VERIFIED" as const,
      description: `Local repository surface ${path}.`,
      tags: [type, "workspace"],
    })),
  );

  const blockerResults = [...productMatrix.routes, ...productMatrix.features]
    .filter((item) => item.state === "BLOCKED")
    .map((item) => ({
      id: `blocker:${"path" in item ? item.path : item.id}`,
      title: "path" in item ? item.path : item.id,
      type: "blocker" as const,
      path: "data/product-surface-matrix.json",
      status: "BLOCKED" as const,
      description: item.evidence,
      tags: ["blocker", "phkd"],
    }));
  const hardeningBlockerResults = Object.entries(hardeningMatrix.domains ?? {}).flatMap(([domain, gates]) =>
    gates
      .filter((gate) => gate.state === "BLOCKED")
      .map((gate) => ({
        id: `blocker:${domain}`,
        title: domain,
        type: "blocker" as const,
        path: "release/reports/PRODUCTION_HARDENING_MATRIX.json",
        status: "BLOCKED" as const,
        description: `${gate.gate}: ${gate.evidence}`,
        tags: ["blocker", "phkd", domain.toLowerCase(), gate.gate.toLowerCase()],
      })),
  );

  return [...routeResults, ...featureResults, ...stateResults, ...docResults, ...surfaceResults, ...blockerResults, ...hardeningBlockerResults];
}

export function searchUnifiedIndex(query: string, filters: SearchFilters = {}, index = buildUnifiedSearchIndex()): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  const words = normalizedQuery ? normalizedQuery.split(/\s+/) : [];

  return index
    .filter((result) => {
      if (filters.type && filters.type !== "all" && result.type !== filters.type) {
        return false;
      }
      if (filters.status && filters.status !== "all" && result.status !== filters.status) {
        return false;
      }
      if (words.length === 0) {
        return true;
      }
      const haystack = [result.title, result.type, result.path, result.status, result.description, ...result.tags].join(" ").toLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => scoreResult(b, words) - scoreResult(a, words) || a.title.localeCompare(b.title))
    .slice(0, 40);
}

export function isNavigableSearchResult(result: SearchResult): boolean {
  return result.type === "route" && implementedRoutes.has(result.path) && result.status !== "BLOCKED";
}

export const SEARCH_RESULT_TYPES: ReadonlyArray<SearchResultType | "all"> = [
  "all",
  "route",
  "feature",
  "state",
  "doc",
  "evidence",
  "package",
  "app",
  "crate",
  "blocker",
] as const;

function scoreResult(result: SearchResult, words: string[]): number {
  if (words.length === 0) {
    return result.status === "BLOCKED" ? 2 : 1;
  }
  const title = result.title.toLowerCase();
  return words.reduce((score, word) => score + (title.includes(word) ? 5 : result.tags.some((tag) => tag.includes(word)) ? 2 : 1), 0);
}
