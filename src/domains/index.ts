import registryData from "../../data/domain-registry.json" with { type: "json" };

export const DOMAIN_ROUTE_PATHS = ["/domains", "/domains/status", "/domains/runtime"] as const;

export type DomainRoutePath = (typeof DOMAIN_ROUTE_PATHS)[number];
export type DomainDnsState = "VERIFIED" | "UNKNOWN" | "BLOCKED";
export type DomainRuntimeState = "PREVIEW_VERIFIED" | "STAGED" | "UNKNOWN" | "BLOCKED";

export type DomainRegistryRoute = {
  path: DomainRoutePath;
  state: "PREVIEW_VERIFIED";
  artifact: string;
  evidence: string;
};

export type DomainRegistryEntry = {
  id: string;
  domain: string;
  surface: string;
  route: string;
  runtime: string;
  dnsState: DomainDnsState;
  runtimeState: DomainRuntimeState;
  evidence: string;
  blocker: string;
};

export type GovernedDomainRegistry = {
  schema: "maataa.domain-registry.v1";
  finalStatus: "CONTROLLED_NO_GO";
  productionReady: false;
  phkdVerdict: "BLOCKED";
  evidence: string;
  routes: DomainRegistryRoute[];
  domains: DomainRegistryEntry[];
};

export type DomainRegistrySummary = {
  total: number;
  dnsUnknown: number;
  dnsBlocked: number;
  runtimeUnknown: number;
  runtimeBlocked: number;
  missingRoutes: number;
  previewRoutes: number;
  blockers: Array<{ domain: string; route: string; reason: string }>;
};

const implementedRoutes = new Set<string>(["/", ...DOMAIN_ROUTE_PATHS]);
const registry = registryData as GovernedDomainRegistry;

export function getGovernedDomainRegistry(): GovernedDomainRegistry {
  assertHonestRegistry(registry);
  return registry;
}

export function summarizeDomainRegistry(domains = registry.domains): DomainRegistrySummary {
  const blockers = domains
    .filter((domain) => hasDomainBlocker(domain))
    .map((domain) => ({ domain: domain.domain, route: domain.route, reason: domain.blocker }));

  return {
    total: domains.length,
    dnsUnknown: domains.filter((domain) => domain.dnsState === "UNKNOWN").length,
    dnsBlocked: domains.filter((domain) => domain.dnsState === "BLOCKED").length,
    runtimeUnknown: domains.filter((domain) => domain.runtimeState === "UNKNOWN").length,
    runtimeBlocked: domains.filter((domain) => domain.runtimeState === "BLOCKED").length,
    missingRoutes: domains.filter((domain) => !isDomainRouteImplemented(domain.route)).length,
    previewRoutes: registry.routes.length,
    blockers,
  };
}

export function isDomainRouteImplemented(route: string): boolean {
  return implementedRoutes.has(route);
}

export function domainSearchStatus(domain: DomainRegistryEntry): DomainRuntimeState | "BLOCKED" {
  if (!isDomainRouteImplemented(domain.route)) {
    return "BLOCKED";
  }
  if (domain.runtimeState === "BLOCKED" || domain.dnsState === "BLOCKED") {
    return "BLOCKED";
  }
  if (domain.dnsState === "UNKNOWN") {
    return "UNKNOWN";
  }
  return domain.runtimeState;
}

export function hasDomainBlocker(domain: DomainRegistryEntry): boolean {
  return Boolean(domain.blocker) || domain.dnsState !== "VERIFIED" || domain.runtimeState === "UNKNOWN" || domain.runtimeState === "BLOCKED" || !isDomainRouteImplemented(domain.route);
}

export function assertHonestRegistry(value: GovernedDomainRegistry): void {
  if (value.productionReady !== false || value.finalStatus !== "CONTROLLED_NO_GO" || value.phkdVerdict !== "BLOCKED") {
    throw new Error("DOMAIN_REGISTRY_PRODUCTION_CLAIM_BLOCKED");
  }
  for (const domain of value.domains) {
    if ((domain.dnsState as string) === "LIVE" || (domain.runtimeState as string) === "LIVE") {
      throw new Error(`DOMAIN_REGISTRY_FAKE_LIVE_STATE:${domain.domain}`);
    }
    if (hasDomainBlocker(domain) && !domain.blocker) {
      throw new Error(`DOMAIN_REGISTRY_BLOCKER_REQUIRED:${domain.domain}`);
    }
  }
}
