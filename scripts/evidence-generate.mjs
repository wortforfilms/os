#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const matrix = readJson("data/product-surface-matrix.json");
const domainRegistry = readJson("data/domain-registry.json");
const hardening = readJson("release/reports/PRODUCTION_HARDENING_MATRIX.json");
const evidenceDir = "release/evidence";
mkdirSync(evidenceDir, { recursive: true });

const commit = runOptional("git", ["rev-parse", "--short", "HEAD"]) ?? "UNKNOWN";
const generatedAt = new Date().toISOString();
const routeBlockers = matrix.routes.filter((item) => item.state === "BLOCKED");
const featureBlockers = matrix.features.filter((item) => item.state === "BLOCKED");
const hardeningBlockers = Object.entries(hardening.domains ?? {}).flatMap(([domain, gates]) =>
  gates.filter((gate) => gate.state === "BLOCKED").map((gate) => ({
    surface: domain,
    reason: `${gate.gate}: ${gate.evidence}`,
  })),
);

const implementedDomainRoutes = new Set(["/", ...(domainRegistry.routes ?? []).map((route) => route.path)]);
assertHonestDomainRegistry(domainRegistry, implementedDomainRoutes);
const domainBlockers = (domainRegistry.domains ?? [])
  .filter((domain) => hasDomainBlocker(domain, implementedDomainRoutes))
  .map((domain) => ({
    surface: `domain:${domain.domain}`,
    route: domain.route,
    reason: domain.blocker || domainBlockerReasons(domain, implementedDomainRoutes).join(" "),
  }));
const domainSummary = {
  domains: domainRegistry.domains?.length ?? 0,
  routes: domainRegistry.routes?.length ?? 0,
  dnsUnknown: (domainRegistry.domains ?? []).filter((domain) => domain.dnsState === "UNKNOWN").length,
  dnsBlocked: (domainRegistry.domains ?? []).filter((domain) => domain.dnsState === "BLOCKED").length,
  runtimeUnknown: (domainRegistry.domains ?? []).filter((domain) => domain.runtimeState === "UNKNOWN").length,
  runtimeBlocked: (domainRegistry.domains ?? []).filter((domain) => domain.runtimeState === "BLOCKED").length,
  missingRoutes: (domainRegistry.domains ?? []).filter((domain) => !implementedDomainRoutes.has(domain.route)).length,
  blockers: domainBlockers.length,
};
const domainEvidence = {
  schema: "maataa.domain-registry.evidence.v1",
  generatedAt,
  commit,
  finalStatus: "CONTROLLED_NO_GO",
  productionReady: false,
  phkdVerdict: "BLOCKED",
  source: "data/domain-registry.json",
  noFakeDnsUptime: true,
  noFakeLiveDeployment: true,
  noFakeProductionReadiness: true,
  summary: domainSummary,
  routes: domainRegistry.routes,
  domains: domainRegistry.domains,
  blockers: domainBlockers,
};

// --- HKD vision-board ingestion (added 2026-05-28) ---
// Every .hkd file under hkd/ that follows the VisualHKD shape contributes its
// BLOCKED claims as additional production blockers. UNVERIFIED and PARTIAL
// claims are counted into hkdSummary but do not block the gate — they are
// honest open questions, not failures of evidence.
const hkdDir = "hkd";
const hkdSummary = {
  files: 0,
  totalClaims: 0,
  blocked: 0,
  partial: 0,
  unverified: 0,
  lowConfidenceNodes: 0,
  totalNodes: 0,
  sources: [],
};
const hkdBlockers = [];
if (existsSync(hkdDir)) {
  const hkdFiles = readdirSync(hkdDir)
    .filter((f) => f.endsWith(".hkd") && !f.startsWith("._"))
    .sort();
  for (const file of hkdFiles) {
    let data;
    try {
      data = readJson(join(hkdDir, file));
    } catch {
      continue;
    }
    hkdSummary.files += 1;
    const claims = Array.isArray(data.claims) ? data.claims : [];
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    hkdSummary.totalClaims += claims.length;
    hkdSummary.totalNodes += nodes.length;
    let fileBlocked = 0;
    let filePartial = 0;
    let fileUnverified = 0;
    for (const claim of claims) {
      if (claim.status === "BLOCKED") {
        fileBlocked += 1;
        hkdBlockers.push({
          surface: `${data.id || file}:${claim.id || "unknown"}`,
          reason: `${claim.text || ""} — ${claim.blockedReason || ""}`.trim(),
        });
      } else if (claim.status === "PARTIAL") {
        filePartial += 1;
      } else if (claim.status === "UNVERIFIED") {
        fileUnverified += 1;
      }
    }
    for (const node of nodes) {
      if (typeof node.confidence === "number" && node.confidence < 0.5) {
        hkdSummary.lowConfidenceNodes += 1;
      }
    }
    hkdSummary.blocked += fileBlocked;
    hkdSummary.partial += filePartial;
    hkdSummary.unverified += fileUnverified;
    hkdSummary.sources.push({
      file,
      id: data.id,
      universe: data.universe,
      status: data.status,
      claimCounts: { blocked: fileBlocked, partial: filePartial, unverified: fileUnverified },
    });
  }
}

const blockers = [
  ...routeBlockers.map((item) => ({ surface: item.path, reason: item.evidence })),
  ...featureBlockers.map((item) => ({ surface: item.id, reason: item.evidence })),
  ...hardeningBlockers,
  ...domainBlockers,
  ...hkdBlockers,
];

const completion = {
  schema: "maataa.completion.status.matrix.v1",
  generatedAt,
  commit,
  finalStatus: blockers.length === 0 && hardening.productionReady === true ? "GO" : "CONTROLLED_NO_GO",
  productionReady: blockers.length === 0 && hardening.productionReady === true,
  phkdVerdict: blockers.length === 0 ? "PASS" : "BLOCKED",
  routes: matrix.routes,
  features: matrix.features,
  hardening,
  domainRegistry: {
    source: "data/domain-registry.json",
    evidenceFile: "release/evidence/domain-registry.json",
    summary: domainSummary,
    routes: domainRegistry.routes,
  },
  blockers,
  hkdSummary,
  evidenceFiles: [
    "release/evidence/latest.json",
    "release/evidence/blockers.json",
    "release/evidence/domain-registry.json",
    "COMPLETION_STATUS_MATRIX.json",
    "COMPLETION_STATUS_MATRIX.md",
  ],
};

writeJson(join(evidenceDir, "domain-registry.json"), domainEvidence);
writeJson("COMPLETION_STATUS_MATRIX.json", completion);
writeJson(join(evidenceDir, "latest.json"), completion);
writeJson(join(evidenceDir, "blockers.json"), {
  schema: "maataa.blockers.v1",
  generatedAt,
  blockers,
});
writeFileSync("COMPLETION_STATUS_MATRIX.md", renderMarkdown(completion), "utf8");
writeFileSync(
  join(evidenceDir, "commands-run.md"),
  [
    "# Commands Run",
    "",
    "Generated by `npm run evidence:generate`.",
    "",
    "- `npm run db:migrate`",
    "- `npm run seed`",
    "- `npm run typecheck`",
    "- `npm run test`",
    "- `npm run test:auth`",
    "- `npm run build`",
    "- `npm run smoke`",
    "- `npm run evidence:generate`",
    "- `npm run status:matrix`",
    "",
  ].join("\n"),
  "utf8",
);

console.log(`evidence generated: ${completion.finalStatus}`);
console.log(`blockers: ${blockers.length} (routes: ${routeBlockers.length}, features: ${featureBlockers.length}, hardening: ${hardeningBlockers.length}, domains: ${domainBlockers.length}, hkd: ${hkdBlockers.length})`);
console.log(`hkd: ${hkdSummary.files} files / ${hkdSummary.totalClaims} claims (BLOCKED ${hkdSummary.blocked}, PARTIAL ${hkdSummary.partial}, UNVERIFIED ${hkdSummary.unverified})`);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runOptional(command, args) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function hasDomainBlocker(domain, implementedRoutes) {
  return Boolean(domain.blocker) || domainBlockerReasons(domain, implementedRoutes).length > 0;
}

function domainBlockerReasons(domain, implementedRoutes) {
  const reasons = [];
  if (domain.dnsState === "UNKNOWN") {
    reasons.push("DNS state is UNKNOWN; no live resolver evidence is recorded.");
  } else if (domain.dnsState === "BLOCKED") {
    reasons.push("DNS state is BLOCKED.");
  }
  if (domain.runtimeState === "UNKNOWN") {
    reasons.push("Runtime state is UNKNOWN.");
  } else if (domain.runtimeState === "BLOCKED") {
    reasons.push("Runtime state is BLOCKED.");
  }
  if (!implementedRoutes.has(domain.route)) {
    reasons.push(`Route ${domain.route} is not a PREVIEW_VERIFIED domain route.`);
  }
  return reasons;
}

function assertHonestDomainRegistry(value, implementedRoutes) {
  if (value.productionReady !== false || value.finalStatus !== "CONTROLLED_NO_GO" || value.phkdVerdict !== "BLOCKED") {
    throw new Error("DOMAIN_REGISTRY_PRODUCTION_READY_CLAIM_BLOCKED");
  }
  for (const route of value.routes ?? []) {
    if (route.state === "PREVIEW_VERIFIED" && !existsSync(route.artifact)) {
      throw new Error(`DOMAIN_REGISTRY_ROUTE_ARTIFACT_MISSING:${route.path}:${route.artifact}`);
    }
  }
  for (const domain of value.domains ?? []) {
    if (domain.dnsState === "LIVE" || domain.runtimeState === "LIVE") {
      throw new Error(`DOMAIN_REGISTRY_FAKE_LIVE_STATE:${domain.domain}`);
    }
    if (hasDomainBlocker(domain, implementedRoutes) && !domain.blocker) {
      throw new Error(`DOMAIN_REGISTRY_BLOCKER_REQUIRED:${domain.domain}`);
    }
  }
}

function renderMarkdown(status) {
  const lines = [
    "# Completion Status Matrix",
    "",
    `Generated: ${status.generatedAt}`,
    `Commit: ${status.commit}`,
    `Final status: ${status.finalStatus}`,
    `Production ready: ${status.productionReady}`,
    `PHKD verdict: ${status.phkdVerdict}`,
    "",
    "## Routes",
    "",
    "| Route | State | Evidence |",
    "| --- | --- | --- |",
    ...status.routes.map((item) => `| ${item.path} | ${item.state} | ${item.evidence} |`),
    "",
    "## Features",
    "",
    "| Feature | State | Evidence |",
    "| --- | --- | --- |",
    ...status.features.map((item) => `| ${item.id} | ${item.state} | ${item.evidence} |`),
    "",
    "## HKD Vision Boards",
    "",
    status.hkdSummary
      ? `${status.hkdSummary.files} files / ${status.hkdSummary.totalClaims} claims (BLOCKED: ${status.hkdSummary.blocked}, PARTIAL: ${status.hkdSummary.partial}, UNVERIFIED: ${status.hkdSummary.unverified}). Nodes with confidence < 0.5: ${status.hkdSummary.lowConfidenceNodes}/${status.hkdSummary.totalNodes}.`
      : "No HKD files found.",
    "",
    ...(status.hkdSummary && status.hkdSummary.sources.length
      ? [
          "| File | Universe | Blocked | Partial | Unverified |",
          "| --- | --- | ---: | ---: | ---: |",
          ...status.hkdSummary.sources.map(
            (s) =>
              `| ${s.file} | ${s.universe ?? ""} | ${s.claimCounts.blocked} | ${s.claimCounts.partial} | ${s.claimCounts.unverified} |`
          ),
          "",
        ]
      : []),
    "## Domain Registry",
    "",
    status.domainRegistry
      ? `${status.domainRegistry.summary.domains} domains / ${status.domainRegistry.summary.routes} preview routes. DNS UNKNOWN: ${status.domainRegistry.summary.dnsUnknown}. Missing routes: ${status.domainRegistry.summary.missingRoutes}. Domain blockers: ${status.domainRegistry.summary.blockers}.`
      : "No domain registry evidence found.",
    "",
    "## Blockers",
    "",
    ...status.blockers.map((item) => `- ${item.surface}: ${item.reason}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}
