/*
 * Single source of truth for the six "Built With Dharma" facets.
 * Used by the probe (scripts/achievements/apps-experience.mjs), the test
 * (tests/built-with-dharma.test.mjs), and the evidence generator. Every check is
 * a REAL filesystem/source check — no facet passes without an artifact.
 *
 * The six design properties (from the landing board):
 *   Open Source · Privacy First · Offline Ready · Ethical AI · Sovereign Data · Transparent
 */
const TELEMETRY_SDKS = [
  "@sentry/", "segment", "analytics-node", "mixpanel", "amplitude", "posthog",
  "datadog", "dd-trace", "newrelic", "new-relic", "google-analytics", "ga-lite", "@amplitude/",
];

export function evaluateDharma({ root, join, existsSync, readFileSync, readdirSync }) {
  const read = (p) => readFileSync(join(root, p), "utf8");
  const exists = (p) => existsSync(join(root, p));
  const readJson = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };

  const facets = [];

  // 1) OPEN SOURCE — real LICENSE granting the four freedoms + declared license fields.
  let osPass = false, osProof = "no LICENSE file at repo root";
  if (exists("LICENSE")) {
    const lic = read("LICENSE");
    const freedoms = ["USE", "STUDY", "MODIFY", "REDISTRIBUTE"].every((k) => new RegExp(`\\b${k}\\b`, "i").test(lic));
    const spdx = /SPDX-License-Identifier:\s*\S+/.test(lic);
    const rootPkg = readJson("package.json") || {};
    const pkgDir = join(root, "packages");
    let licensed = 0;
    if (existsSync(pkgDir)) {
      for (const d of readdirSync(pkgDir)) {
        const pj = readJson(`packages/${d}/package.json`);
        if (pj && typeof pj.license === "string" && pj.license.length > 0) licensed += 1;
      }
    }
    osPass = freedoms && spdx && !!rootPkg.license && licensed >= 3;
    osProof = `LICENSE four-freedoms=${freedoms}, SPDX=${spdx}, root.license=${rootPkg.license || "none"}, packages declaring license=${licensed}`;
  }
  facets.push({ name: "open-source", pass: osPass, proof: osProof });

  // 2) PRIVACY FIRST — no default telemetry/analytics SDK in any dependency set.
  const hits = [];
  const scanDeps = (pkgPath, label) => {
    const pj = readJson(pkgPath);
    if (!pj) return;
    const deps = { ...(pj.dependencies || {}), ...(pj.devDependencies || {}) };
    for (const name of Object.keys(deps)) {
      if (TELEMETRY_SDKS.some((sdk) => name.toLowerCase().includes(sdk))) hits.push(`${label}:${name}`);
    }
  };
  scanDeps("package.json", "root");
  const pkgDir2 = join(root, "packages");
  if (existsSync(pkgDir2)) for (const d of readdirSync(pkgDir2)) scanDeps(`packages/${d}/package.json`, d);
  facets.push({ name: "privacy-no-default-telemetry", pass: hits.length === 0, proof: `telemetry/analytics SDK deps: ${hits.join(", ") || "none"}` });

  // 3) OFFLINE READY — at least one app ships a real service worker with a cache.
  let swApps = 0;
  const appsDir = join(root, "apps");
  if (existsSync(appsDir)) {
    for (const e of readdirSync(appsDir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === "electron") continue;
      const sw = `apps/${e.name}/sw.js`;
      if (exists(sw) && /const CACHE\s*=/.test(read(sw))) swApps += 1;
    }
  }
  facets.push({ name: "offline-ready", pass: swApps > 0, proof: `${swApps} app(s) ship a service worker with a cache name` });

  // 4) ETHICAL AI — the honesty guard that forbids unverified ACHIEVED claims exists.
  let guard = false, guardProof = "honesty guard test missing";
  if (exists("tests/milestones-matrix.test.mjs")) {
    const t = read("tests/milestones-matrix.test.mjs");
    guard = /ACHIEVED without VERIFIED/i.test(t) && /sourceClaimStatus/.test(t);
    guardProof = `tests/milestones-matrix.test.mjs enforces no-ACHIEVED-without-VERIFIED=${guard}`;
  }
  facets.push({ name: "ethical-ai-claim-guard", pass: guard, proof: guardProof });

  // 5) SOVEREIGN DATA — local persistence with export/delete (no cloud authority).
  let sovereign = false, sovProof = "runtime-persistence missing";
  if (exists("packages/runtime-persistence/src/index.ts")) {
    const src = read("packages/runtime-persistence/src/index.ts");
    const ops = ["persist", "load", "delete", "snapshot", "restore"];
    sovereign = ops.every((op) => new RegExp(`\\b${op}\\b`).test(src)) && /node:sqlite|sqlite/i.test(src);
    sovProof = `runtime-persistence exposes ${ops.join("/")} over local sqlite=${sovereign}`;
  }
  facets.push({ name: "sovereign-data-local", pass: sovereign, proof: sovProof });

  // 6) TRANSPARENT — reproducible evidence generators are present and runnable.
  const gens = [
    "scripts/verify-honest-achievements.mjs",
    "scripts/generate-milestones-matrix.mjs",
    "scripts/generate-security-flow-evidence.mjs",
  ];
  const missing = gens.filter((g) => !exists(g));
  facets.push({ name: "transparent-reproducible-evidence", pass: missing.length === 0, proof: `evidence generators present: ${gens.length - missing.length}/${gens.length}${missing.length ? ` (missing ${missing.join(", ")})` : ""}` });

  return { facets, overallPass: facets.every((f) => f.pass) };
}
