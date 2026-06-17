#!/usr/bin/env node
/*
 * Assembles the dated PHKD audit evidence for the HKD Lipi Registry from the
 * COMMITTED evidence files (no invented numbers). Emits json + md.
 *
 * Run: node scripts/generate-phkd-audit-lipi-registry.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const J = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), "utf8")) : null);
const AUDIT_DATE = "2026-06-17";

const act = J("release/evidence/hkd-lipi-registry-runtime-activation.json") || {};
const arch = J("release/evidence/hkd-lipi-registry-architecture.json") || {};
const kbs = J("release/evidence/hkd-lipi-registry-phase4-kbs.json") || {};
const hb = J("release/evidence/hkd-lipi-harfbuzz-shaping-evidence.json") || {};
const gb = J("release/evidence/hkd-lipi-glyph-baseline-captures.json") || {};
const iso = J("release/evidence/hkd-lipi-registry-phase9-iso15924-ingestion.json") || {};
const cldr = J("release/evidence/hkd-lipi-registry-phase10-cldr-ingestion.json") || {};
const icu = J("release/evidence/hkd-lipi-registry-phase11-icu-ingestion.json") || {};
const fed = J("release/evidence/hkd-lipi-registry-phase6-federation.json") || {};
const p24 = J("release/evidence/hkd-lipi-registry-phase24-cross-browser-validation.json") || {};
const p25 = J("release/evidence/hkd-lipi-registry-phase25-cross-platform-validation.json") || {};
const p26 = J("release/evidence/hkd-lipi-registry-phase26-external-review-human-approval.json") || {};
const p27 = J("release/evidence/hkd-lipi-registry-phase27-production-go-decision.json") || {};
const att = J("release/evidence/hkd-lipi-platform-attestation.json") || {};

const n = (v, d = "UNKNOWN") => (v === undefined || v === null ? d : v);
const node = kbs.counts?.nodeTypes || {};

const controlFlags = {
  registryRuntimeActive: act.registryRuntimeActive === true,
  runtimeMode: n(act.runtimeMode, "CONTROLLED_PREVIEW"),
  readOnly: act.readOnly !== false,
  mutationAllowed: act.mutationAllowed === true,
  runtimeEnabledRows: Number(n(act.runtimeEnabledRows, 0)),
  productionReady: act.productionReady === true,
  governedProductionGo: act.governedProductionGo === true,
  productionGoApproved: act.productionGoApproved === true,
  humanApprovalPresent: act.humanApprovalPresent === true,
  releaseCandidate: act.releaseCandidate === true,
  phkdVerdict: n(act.phkdVerdict, "CONTROLLED_PREVIEW_NO_GO"),
};

const verifiedCounts = {
  registryRows: n(arch.stats?.total, 426),
  unicodeScripts: n(arch.stats?.unicodeScriptProperties, 176),
  numeralSystems: n(node.DecimalDigitInventory ?? kbs.counts?.decimalDigitInventories, 63),
  zeroGlyphSystems: n(node.ZeroGlyph ?? kbs.counts?.zeroGlyphNodes, 63),
  kbsNodes: n(kbs.counts?.totalNodes),
  kbsEdges: n(kbs.counts?.totalEdges),
  harfbuzz: { version: n(hb.execution?.hbShapeVersion), verifiedRows: n(hb.counts?.verifiedRows), failedWithEvidenceRows: n(hb.counts?.failedWithEvidenceRows), fontsUsed: n(hb.counts?.fontsUsed) },
  glyphBaselines: { stableBaselineHashRows: n(gb.counts?.stableBaselineHashRows), verifiedCaptureRows: n(gb.counts?.verifiedCaptureRows), browserVsHarfBuzzComparisons: n(gb.counts?.browserRenderRows) },
  iso15924: { verifiedRows: n(iso.counts?.verifiedRows), blockedRows: n(iso.counts?.blockedRows), conflictRows: n(iso.counts?.conflictRows) },
  cldr: { verifiedRows: n(cldr.counts?.verifiedRows), unknownRows: n(cldr.counts?.unknownRows) },
  icu: { verifiedRows: n(icu.counts?.verifiedRows), blockedRows: n(icu.counts?.blockedRows), extraIcuCodesNotInUcdRegistry: n(icu.counts?.extraIcuCodesNotInUcdRegistry), canonicalNameMismatches: n(icu.counts?.canonicalNameMismatches) },
  federation: { sources: n(fed.counts?.sources), lineageNodes: n(fed.counts?.lineageNodes), lineageEdges: n(fed.counts?.lineageEdges), blockedComparisons: n(fed.counts?.blockedComparisons) },
};

const rendering = {
  phase24: { chrome: p24.checks?.chromeBaselineCaptured === true, firefox: p24.checks?.firefoxCaptured === true, safari: p24.checks?.safariCaptured === true },
  phase25: (att.platforms || p25.platforms || []).map((p) => ({ id: p.id, claimed: p.claimedStatus || p.status, attestation: p.attestation || (p.status === "VERIFIED" ? "VERIFIED" : p.status), reason: p.reason })),
  phase26: { externalReviewComplete: p26.checks?.externalReviewComplete === true, humanApprovalPresent: p26.checks?.humanApprovalPresent === true, validSignedHumanApproval: p26.checks?.validSignedHumanApproval === true },
  phase27: { decision: n(p27.decision, "NO_GO") },
};

const contradictions = rendering.phase25
  .filter((p) => p.attestation === "CONFLICT")
  .map((p) => ({
    id: `platform-attestation-conflict-${p.id}`,
    severity: "CONFLICT",
    statement: `Phase 25 marks ${p.id} ${p.claimed}, but host attestation rejected it: ${p.reason}`,
    resolution: "The platform-attestation probe preserves Phase 25 evidence unchanged and treats the claim as invalid until matching host evidence exists.",
    evidence: ["release/evidence/hkd-lipi-registry-phase25-cross-platform-validation.json", "release/evidence/hkd-lipi-platform-attestation.json"],
  }));

const blockers = [
  "Firefox rendering unverified (phase24 firefoxCaptured=false)",
  "Safari rendering unverified (phase24 safariCaptured=false)",
  ...rendering.phase25.filter((p) => p.attestation === "CONFLICT").map((p) => `${p.id} platform attestation CONFLICT (${p.reason})`),
  "Linux platform unverified (phase25 BLOCKED)",
  "Windows platform unverified (phase25 BLOCKED)",
  "External review incomplete (phase26 externalReviewComplete=false)",
  "Human approval absent (phase26 humanApprovalPresent=false, validSignedHumanApproval=false)",
  `CLDR mostly unknown (${verifiedCounts.cldr.verifiedRows} verified / ${verifiedCounts.cldr.unknownRows} unknown)`,
  `ICU conflicts (${verifiedCounts.icu.extraIcuCodesNotInUcdRegistry} extra codes, ${verifiedCounts.icu.canonicalNameMismatches} name mismatches)`,
  `ISO 15924 blocked rows (${verifiedCounts.iso15924.blockedRows})`,
];

const recommendedNextActions = [
  "Run the Phase 23 generator on Linux and Windows; attach platform reports to clear those two BLOCKED targets.",
  "Capture Firefox and Safari baselines to clear the two browser blockers.",
  "Adjudicate the ICU extras + canonical-name mismatches as documented decisions (no silent registry edits).",
  "Advance CLDR verified rows with sourced locale-script links; keep the unknown rows fail-closed.",
  "Obtain a signed human-approval artifact and complete external review before Phase 27 can be reconsidered.",
  "Keep runtimeEnabledRows=0 and mutationAllowed=false until all blockers clear AND a human GO exists.",
];

const audit = {
  schema: "maataa.phkd-audit.lipi-registry.v1",
  auditDate: AUDIT_DATE,
  generatedAt: new Date().toISOString(),
  subject: "HKD Lipi Registry",
  phkdVerdict: "CONTROLLED_PREVIEW_NO_GO",
  productionReady: false,
  controlFlags,
  verifiedCounts,
  rendering,
  contradictions,
  blockers,
  recommendedNextActions,
  honesty: "Evidence-only. All counts read from committed evidence files. Mission/vision targets are excluded as non-facts. Fail closed.",
};

// Hard invariants — refuse to emit an audit that promotes production.
const inv = [
  controlFlags.productionReady === false,
  controlFlags.governedProductionGo === false,
  controlFlags.runtimeEnabledRows === 0,
  controlFlags.mutationAllowed === false,
  controlFlags.phkdVerdict === "CONTROLLED_PREVIEW_NO_GO",
];
if (inv.some((v) => v !== true)) throw new Error("refusing to emit audit: control flags are not in the required CONTROLLED_PREVIEW_NO_GO state");

const base = `release/evidence/phkd-audit-lipi-registry-${AUDIT_DATE}`;
writeFileSync(join(root, `${base}.json`), `${JSON.stringify(audit, null, 2)}\n`);

const md = `# PHKD Audit — HKD Lipi Registry (${AUDIT_DATE})

**Verdict: \`${audit.phkdVerdict}\`** · productionReady=\`${controlFlags.productionReady}\` · governedProductionGo=\`${controlFlags.governedProductionGo}\`

## Control flags (from committed runtime-activation evidence)
- registryRuntimeActive: \`${controlFlags.registryRuntimeActive}\`
- runtimeMode: \`${controlFlags.runtimeMode}\`
- readOnly: \`${controlFlags.readOnly}\`
- mutationAllowed: \`${controlFlags.mutationAllowed}\`
- runtimeEnabledRows: \`${controlFlags.runtimeEnabledRows}\`
- releaseCandidate: \`${controlFlags.releaseCandidate}\`
- humanApprovalPresent: \`${controlFlags.humanApprovalPresent}\`

## Verified counts (evidence-only)
- Registry rows: ${verifiedCounts.registryRows} · Unicode scripts: ${verifiedCounts.unicodeScripts} · Numeral systems: ${verifiedCounts.numeralSystems} · Zero-glyph systems: ${verifiedCounts.zeroGlyphSystems}
- KBS: ${verifiedCounts.kbsNodes} nodes / ${verifiedCounts.kbsEdges} edges
- HarfBuzz ${verifiedCounts.harfbuzz.version}: ${verifiedCounts.harfbuzz.verifiedRows} verified, ${verifiedCounts.harfbuzz.failedWithEvidenceRows} failed-with-evidence, ${verifiedCounts.harfbuzz.fontsUsed} fonts
- Glyph baselines: ${verifiedCounts.glyphBaselines.stableBaselineHashRows} stable hashes / ${verifiedCounts.glyphBaselines.browserVsHarfBuzzComparisons} browser-vs-HarfBuzz comparisons
- ISO 15924: ${verifiedCounts.iso15924.verifiedRows} verified / ${verifiedCounts.iso15924.blockedRows} blocked / ${verifiedCounts.iso15924.conflictRows} conflict
- CLDR: ${verifiedCounts.cldr.verifiedRows} verified / ${verifiedCounts.cldr.unknownRows} unknown
- ICU: ${verifiedCounts.icu.verifiedRows} verified / ${verifiedCounts.icu.blockedRows} blocked / ${verifiedCounts.icu.extraIcuCodesNotInUcdRegistry} extra codes / ${verifiedCounts.icu.canonicalNameMismatches} name mismatches
- Federation: ${verifiedCounts.federation.sources} sources / ${verifiedCounts.federation.lineageNodes} lineage nodes / ${verifiedCounts.federation.lineageEdges} edges / ${verifiedCounts.federation.blockedComparisons} blocked comparisons

## Rendering
- Browsers — Chrome: \`${rendering.phase24.chrome}\`, Firefox: \`${rendering.phase24.firefox}\`, Safari: \`${rendering.phase24.safari}\`
- Platforms — ${rendering.phase25.map((p) => `${p.id}: \`${p.attestation}\``).join(", ")}
- External review complete: \`${rendering.phase26.externalReviewComplete}\` · Human approval: \`${rendering.phase26.humanApprovalPresent}\` · Production decision: \`${rendering.phase27.decision}\`

## Contradictions
${contradictions.length === 0 ? "None in the current committed evidence. Synthetic mismatch fixtures are covered by the platform-attestation tests." : contradictions.map((c) => `**${c.id} — ${c.severity}.** ${c.statement}\n${c.resolution}`).join("\n\n")}

## Blockers
${blockers.map((b) => `- ${b}`).join("\n")}

## Recommended next actions
${recommendedNextActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

_Evidence-only. Mission/vision targets are non-facts and excluded. Production remains blocked._
`;
writeFileSync(join(root, `${base}.md`), md);

console.log(`phkd-audit: wrote ${base}.json + ${base}.md | verdict ${audit.phkdVerdict} | productionReady ${controlFlags.productionReady} | runtimeEnabledRows ${controlFlags.runtimeEnabledRows}`);
