import { type ReactNode, useMemo, useState } from "react";
import {
  getLipiCldrIngestionView,
  getLipiEvidenceFederationView,
  getLipiIcuIngestionView,
  getLipiIngestionDryRunView,
  getLipiIso15924IngestionView,
  getLipiKbsGraphView,
  getLipiNumeralZeroView,
  getLipiPhase12To16GovernanceView,
  getLipiPhase17To19GovernanceView,
  getLipiPhase24To27GovernanceView,
  getLipiRegistryAuditabilityView,
  getLipiRenderingValidationView,
  getLipiRegistryRuntimeActivationView,
  getLipiRegistryScript,
  getLipiRegistrySourceSummary,
  getLipiSourceIngestionContractsView,
  getLipiUnicodeCrosswalk,
  getLipiZeroRegistryView,
  listLipiRegistryScripts,
} from "../lipi-registry/api";
import { lipiFullWorkspaceFromRoute, lipiFullWorkspaces, type LipiFullWorkspaceId } from "./surface";

type LipiFullPageProps = {
  route: string;
  navigate: (route: string) => void;
};

export function LipiFullPage({ route, navigate }: LipiFullPageProps) {
  const [query, setQuery] = useState("");
  const workspace = lipiFullWorkspaceFromRoute(route);
  const list = useMemo(() => listLipiRegistryScripts({ q: query, limit: 18 }), [query]);
  const all = useMemo(() => listLipiRegistryScripts({ limit: 426 }), []);
  const numerals = useMemo(() => getLipiNumeralZeroView(), []);
  const zero = useMemo(() => getLipiZeroRegistryView(), []);
  const crosswalk = useMemo(() => getLipiUnicodeCrosswalk(), []);
  const graph = useMemo(() => getLipiKbsGraphView(), []);
  const audit = useMemo(() => getLipiRegistryAuditabilityView(), []);
  const federation = useMemo(() => getLipiEvidenceFederationView(), []);
  const contracts = useMemo(() => getLipiSourceIngestionContractsView(), []);
  const dryRun = useMemo(() => getLipiIngestionDryRunView(), []);
  const iso = useMemo(() => getLipiIso15924IngestionView(), []);
  const cldr = useMemo(() => getLipiCldrIngestionView(), []);
  const icu = useMemo(() => getLipiIcuIngestionView(), []);
  const phase12To16 = useMemo(() => getLipiPhase12To16GovernanceView(), []);
  const phase17To19 = useMemo(() => getLipiPhase17To19GovernanceView(), []);
  const phase24To27 = useMemo(() => getLipiPhase24To27GovernanceView(), []);
  const runtimeActivation = useMemo(() => getLipiRegistryRuntimeActivationView(), []);
  const rendering = useMemo(() => getLipiRenderingValidationView(), []);
  const sources = useMemo(() => getLipiRegistrySourceSummary(), []);
  const scriptId = route.startsWith("/lipi/script/") ? decodeURIComponent(route.replace("/lipi/script/", "")) : null;
  const detail = scriptId ? getLipiRegistryScript(scriptId) : null;

  return (
    <section className="lipi-full-shell" aria-label="Lipi Full">
      <header className="lipi-full-hero">
        <div>
          <p className="dashboard-kicker">Lipi Full</p>
          <h2>Lipi Knowledge System</h2>
          <p>Phase 1-27 registry intelligence, rendering evidence, cross-environment validation, review, audit, export, and release gating.</p>
        </div>
        <div className="lipi-full-gate">
          <strong>{runtimeActivation.registryRuntimeActive ? "Controlled Preview Runtime Active" : all.reviewState}</strong>
          <span>Runtime Mode = {runtimeActivation.runtimeMode}</span>
          <span>Production Ready = {String(all.productionReady)}</span>
          <span>Runtime Enabled = {all.stats.runtimeEnabled}</span>
        </div>
      </header>

      <div className="lipi-full-metrics" aria-label="Lipi Full metrics">
        <Metric label="Registry Rows" value={all.stats.total} />
        <Metric label="Unicode Scripts" value={all.stats.byClass.unicode ?? 0} />
        <Metric label="Numeral Systems" value={numerals.summary.rowsWithDigitInventory} />
        <Metric label="Zero Glyphs" value={zero.summary.zeroGlyphScripts} />
        <Metric label="KBS Nodes" value={graph.summary.totalNodes} />
        <Metric label="KBS Edges" value={graph.summary.totalEdges} />
      </div>

      <div className="lipi-full-layout">
        <aside className="lipi-full-nav" aria-label="Lipi Full navigation">
          {lipiFullWorkspaces.map((item) => (
            <button className={workspace === item.id ? "active" : ""} key={item.id} onClick={() => navigate(item.route)}>
              <span>{item.label}</span>
              <small>{item.route}</small>
            </button>
          ))}
        </aside>
        <main className="lipi-full-main">
          {workspace === "home" ? <HomePanel navigate={navigate} list={all} numerals={numerals} zero={zero} graph={graph} rendering={rendering} runtimeActivation={runtimeActivation} phase24To27={phase24To27} /> : null}
          {workspace === "explorer" ? <ExplorerPanel query={query} setQuery={setQuery} list={list} navigate={navigate} /> : null}
          {workspace === "scripts" ? <ScriptsPanel list={all} navigate={navigate} /> : null}
          {workspace === "script-detail" ? <ScriptDetailPanel detail={detail} navigate={navigate} /> : null}
          {workspace === "numerals" ? <NumeralsPanel numerals={numerals} /> : null}
          {workspace === "zero-registry" ? <ZeroPanel zero={zero} /> : null}
          {workspace === "unicode" ? <UnicodePanel crosswalk={crosswalk} /> : null}
          {workspace === "crosswalks" ? <CrosswalkPanel crosswalk={crosswalk} iso={iso} cldr={cldr} icu={icu} /> : null}
          {workspace === "kbs" ? <KbsPanel graph={graph} /> : null}
          {workspace === "evidence" ? <EvidencePanel audit={audit} federation={federation} contracts={contracts} /> : null}
          {workspace === "federation" ? <FederationPanel federation={federation} /> : null}
          {workspace === "ingestion" ? <IngestionPanel contracts={contracts} dryRun={dryRun} iso={iso} cldr={cldr} icu={icu} phase12To16={phase12To16} /> : null}
          {workspace === "runtime-status" ? <RuntimeStatusPanel activation={runtimeActivation} /> : null}
          {workspace === "rendering" ? <RenderingValidationPanel rendering={rendering} phase24To27={phase24To27} /> : null}
          {workspace === "governance" ? <GovernancePanel phase12To16={phase12To16} phase17To19={phase17To19} phase24To27={phase24To27} /> : null}
          {workspace === "review" ? <ReviewPanel phase17To19={phase17To19} phase24To27={phase24To27} /> : null}
          {workspace === "audit" ? <AuditPanel audit={audit} federation={federation} /> : null}
          {workspace === "export" ? <ExportPanel audit={audit} phase12To16={phase12To16} phase17To19={phase17To19} /> : null}
          {workspace === "release" ? <ReleasePanel phase12To16={phase12To16} phase17To19={phase17To19} phase24To27={phase24To27} /> : null}
          {workspace === "api" ? <ApiPanel sources={sources} /> : null}
        </main>
      </div>
    </section>
  );
}

function HomePanel({
  navigate,
  list,
  numerals,
  zero,
  graph,
  rendering,
  runtimeActivation,
  phase24To27,
}: {
  navigate: (route: string) => void;
  list: ReturnType<typeof listLipiRegistryScripts>;
  numerals: ReturnType<typeof getLipiNumeralZeroView>;
  zero: ReturnType<typeof getLipiZeroRegistryView>;
  graph: ReturnType<typeof getLipiKbsGraphView>;
  rendering: ReturnType<typeof getLipiRenderingValidationView>;
  runtimeActivation: ReturnType<typeof getLipiRegistryRuntimeActivationView>;
  phase24To27: ReturnType<typeof getLipiPhase24To27GovernanceView>;
}) {
  const missions = getLipiExplorerMissions(list, numerals, zero, graph, rendering, runtimeActivation, phase24To27);
  return (
    <Panel title="Home" kicker="Lipi Full Surface Map">
      <div className="lipi-full-status-callout">
        <strong>Verified Registry Stats</strong>
        <span>Imported mock claims are preserved as missions, not facts</span>
      </div>
      <StatGrid
        rows={[
          ["Registry Rows", list.stats.total],
          ["Unicode Scripts", list.stats.byClass.unicode ?? 0],
          ["Numeral Systems", numerals.summary.rowsWithDigitInventory],
          ["Zero Glyphs", zero.summary.zeroGlyphScripts],
          ["KBS Nodes", graph.summary.totalNodes],
          ["KBS Edges", graph.summary.totalEdges],
          ["Glyph Baselines", rendering.glyphBaselineEvidence.captures.counts.verifiedCaptureRows],
          ["Runtime Enabled", runtimeActivation.runtimeEnabledRows],
        ]}
      />
      <div className="lipi-full-map" aria-label="Lipi Full Surface Map">
        <strong>Lipi</strong>
        {lipiFullWorkspaces.slice(1).map((item) => (
          <button key={item.id} onClick={() => navigate(item.route)}>
            <span>{item.label}</span>
            <small>{item.summary}</small>
          </button>
        ))}
      </div>
      <MissionClaimsBoard missions={missions} />
    </Panel>
  );
}

type LipiExplorerMission = {
  title: string;
  importedClaim: string;
  realStat: string;
  mission: string;
  status: string;
};

function getLipiExplorerMissions(
  list: ReturnType<typeof listLipiRegistryScripts>,
  numerals: ReturnType<typeof getLipiNumeralZeroView>,
  zero: ReturnType<typeof getLipiZeroRegistryView>,
  graph: ReturnType<typeof getLipiKbsGraphView>,
  rendering: ReturnType<typeof getLipiRenderingValidationView>,
  runtimeActivation: ReturnType<typeof getLipiRegistryRuntimeActivationView>,
  phase24To27: ReturnType<typeof getLipiPhase24To27GovernanceView>,
): LipiExplorerMission[] {
  const livingSeedRows = list.records.filter((record) => record.cultural_status === "living").length;
  const historicClassRows = list.records.filter((record) => record.registry_class === "historic" || record.cultural_status === "historic").length;
  const knownPrimaryRegions = new Set(
    list.records
      .map((record) => record.region_primary)
      .filter((region): region is string => Boolean(region && region !== "UNKNOWN")),
  ).size;
  const productionDecision = phase24To27.phase27.productionGoDecision;

  return [
    {
      title: "Script Explorer Coverage",
      importedClaim: "Mock claim: 298 scripts, 142 active, 98 historic, 42 regions.",
      realStat: `${list.stats.total} registry rows, ${list.stats.byClass.unicode ?? 0} Unicode rows, ${livingSeedRows} living seed labels, ${historicClassRows} historic rows, ${knownPrimaryRegions} known primary regions.`,
      mission: "Convert active-use and region counts into review-backed evidence instead of headline claims.",
      status: "MISSION_REVIEW_REQUIRED",
    },
    {
      title: "Glyph Library",
      importedClaim: "Mock claim: 18,742 glyphs and symbols.",
      realStat: `${rendering.glyphBaselineEvidence.captures.counts.verifiedCaptureRows} verified glyph baselines, ${numerals.summary.rowsWithDigitInventory} digit inventories, ${zero.summary.zeroGlyphScripts} zero glyphs.`,
      mission: "Ingest source-backed glyph inventories and font fixtures before any large glyph-library count is claimed.",
      status: "MISSION_BLOCKED",
    },
    {
      title: "Evidence Vault",
      importedClaim: "Mock claim: 4,321 evidence records and 9 starter scripts reviewed.",
      realStat: `${graph.summary.totalNodes} KBS nodes, ${graph.summary.totalEdges} KBS edges, ${graph.summary.evidenceSourceNodes} evidence sources, ${rendering.glyphBaselineEvidence.renderDiff.counts.browserVsHarfBuzzComparisons} render comparisons.`,
      mission: "Define one evidence-record counting rule, then regenerate a reproducible evidence total from the graph.",
      status: "MISSION_NEEDS_COUNTING_RULE",
    },
    {
      title: "Runtime Operationality",
      importedClaim: "Mock claim: runtime operational and preview-safe.",
      realStat: `Runtime active=${String(runtimeActivation.registryRuntimeActive)}, mode=${runtimeActivation.runtimeMode}, runtimeEnabledRows=${runtimeActivation.runtimeEnabledRows}, productionReady=${String(productionDecision.summary.productionReady)}.`,
      mission: "Keep exploration read-only until per-row approvals, cross-browser/platform evidence, review, and signed human approval exist.",
      status: "CONTROLLED_PREVIEW_NO_GO",
    },
  ];
}

function MissionClaimsBoard({ missions }: { missions: LipiExplorerMission[] }) {
  return (
    <section className="lipi-full-mission-board" aria-label="Lipi mission claims">
      <header>
        <div>
          <p className="dashboard-kicker">Imported Claims → Missions</p>
          <h4>Mission Claims</h4>
        </div>
        <Badge text="claims are not facts" tone="blocked" />
      </header>
      <div className="lipi-full-mission-grid">
        {missions.map((mission) => (
          <article key={mission.title}>
            <strong>{mission.title}</strong>
            <span>{mission.status}</span>
            <p>{mission.realStat}</p>
            <small>{mission.importedClaim}</small>
            <em>{mission.mission}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExplorerPanel({
  query,
  setQuery,
  list,
  navigate,
}: {
  query: string;
  setQuery: (query: string) => void;
  list: ReturnType<typeof listLipiRegistryScripts>;
  navigate: (route: string) => void;
}) {
  return (
    <Panel title="Explorer" kicker="/lipi/explorer">
      <div className="lipi-full-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scripts, ISO, blocks, evidence..." />
        <Badge text="Filters" />
        <Badge text="Sorting" />
        <Badge text="Saved Views: local placeholder" tone="blocked" />
      </div>
      <RecordGrid records={list.records} navigate={navigate} />
    </Panel>
  );
}

function ScriptsPanel({ list, navigate }: { list: ReturnType<typeof listLipiRegistryScripts>; navigate: (route: string) => void }) {
  return (
    <Panel title="Scripts" kicker="/lipi/scripts">
      <StatGrid
        rows={[
          ["Unicode", list.stats.byClass.unicode ?? 0],
          ["Historic", list.stats.byClass.historic ?? 0],
          ["Notation", list.stats.byClass.notation ?? 0],
          ["Symbol", list.stats.byClass.symbol ?? 0],
        ]}
      />
      <RecordGrid records={list.records.slice(0, 24)} navigate={navigate} />
    </Panel>
  );
}

function ScriptDetailPanel({ detail, navigate }: { detail: ReturnType<typeof getLipiRegistryScript> | null; navigate: (route: string) => void }) {
  if (!detail || !detail.ok) {
    return (
      <Panel title="Script Detail" kicker="/lipi/script/:id">
        <p className="lipi-full-note">SCRIPT_NOT_FOUND</p>
      </Panel>
    );
  }
  const record = detail.record;
  return (
    <Panel title={record.display_name} kicker={`/lipi/script/${record.id}`}>
      <div className="lipi-full-detail-grid">
        <Info title="Unicode" rows={[["Value", record.unicode_script_value], ["ISO 15924", record.iso15924], ["Ranges", record.unicode_ranges.join(", ") || "UNKNOWN"], ["Blocks", record.unicode_blocks.join(", ") || "UNKNOWN"]]} />
        <Info title="Evidence" rows={[["Evidence", record.evidence_status], ["Runtime", record.hkd_runtime_enabled ? "ENABLED" : "DISABLED"], ["Provenance", record.provenance.stance], ["Sources", record.source_refs.join(", ")]]} />
        <Info title="Governance" rows={[["PHKD", "CONTROLLED_NO_GO"], ["Production", "false"], ["Review", record.evidence_status]]} />
      </div>
      <button className="lipi-full-action" onClick={() => navigate(`/lipi-registry/${record.id}`)}>
        Open Legacy Registry Detail
      </button>
    </Panel>
  );
}

function NumeralsPanel({ numerals }: { numerals: ReturnType<typeof getLipiNumeralZeroView> }) {
  return (
    <Panel title="Numeral Explorer" kicker="/lipi/numerals">
      <StatGrid rows={[["Inventories", numerals.summary.rowsWithDigitInventory], ["Known Zero", numerals.summary.rowsWithKnownZeroGlyph], ["Unknown", numerals.summary.rowsStillUnknown]]} />
      <div className="lipi-full-card-grid">
        {numerals.rows.slice(0, 12).map((row) => (
          <article key={row.id}>
            <strong>{row.displayName}</strong>
            <span>{row.zeroCodePoint}</span>
            <p>{row.digits.map((digit) => digit.glyph).join(" ")}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ZeroPanel({ zero }: { zero: ReturnType<typeof getLipiZeroRegistryView> }) {
  return (
    <Panel title="Zero Registry" kicker="/lipi/zero-registry">
      <StatGrid rows={[["Zero Glyph Scripts", zero.summary.zeroGlyphScripts], ["Missing", zero.summary.missingZeroGlyphScripts.length]]} />
      <Rows rows={zero.records.slice(0, 18).map((row) => [row.scriptValue.replace(/_/g, " "), row.zeroGlyph, row.zeroCodePoint, row.provenance.sourcePolicy])} />
    </Panel>
  );
}

function UnicodePanel({ crosswalk }: { crosswalk: ReturnType<typeof getLipiUnicodeCrosswalk> }) {
  return (
    <Panel title="Unicode Workspace" kicker="/lipi/unicode">
      <StatGrid rows={[["Scripts", crosswalk.total], ["Blocks", crosswalk.rows.reduce((sum, row) => sum + row.unicodeBlocks.length, 0)], ["Ranges", crosswalk.rows.reduce((sum, row) => sum + row.unicodeRanges.length, 0)]]} />
      <Rows rows={crosswalk.rows.slice(0, 18).map((row) => [row.displayName, row.unicodeScriptAlias, row.iso15924, `${row.unicodeRanges.length} ranges`])} />
    </Panel>
  );
}

function CrosswalkPanel({
  crosswalk,
  iso,
  cldr,
  icu,
}: {
  crosswalk: ReturnType<typeof getLipiUnicodeCrosswalk>;
  iso: ReturnType<typeof getLipiIso15924IngestionView>;
  cldr: ReturnType<typeof getLipiCldrIngestionView>;
  icu: ReturnType<typeof getLipiIcuIngestionView>;
}) {
  return (
    <Panel title="Crosswalk Explorer" kicker="/lipi/crosswalks">
      <StatGrid rows={[["Unicode", crosswalk.total], ["ISO Verified", iso.crosswalk.summary.verifiedRows], ["CLDR Verified", cldr.crosswalk.summary.verifiedRows], ["ICU Verified", icu.crosswalk.summary.verifiedRows]]} />
      <Rows rows={crosswalk.rows.slice(0, 12).map((row) => [row.displayName, row.unicodeScriptAlias, row.iso15924, row.fontSupportStatus])} />
    </Panel>
  );
}

function KbsPanel({ graph }: { graph: ReturnType<typeof getLipiKbsGraphView> }) {
  return (
    <Panel title="KBS Graph" kicker="/lipi/kbs">
      <StatGrid rows={[["Nodes", graph.summary.totalNodes], ["Edges", graph.summary.totalEdges], ["Scripts", graph.summary.scriptNodes], ["Evidence Sources", graph.summary.evidenceSourceNodes]]} />
      <Rows rows={Object.entries(graph.summary.edgeTypes).map(([type, count]) => [type, String(count), "SCRIPT_EVIDENCE_GRAPH", graph.phkdVerdict])} />
    </Panel>
  );
}

function EvidencePanel({
  audit,
  federation,
  contracts,
}: {
  audit: ReturnType<typeof getLipiRegistryAuditabilityView>;
  federation: ReturnType<typeof getLipiEvidenceFederationView>;
  contracts: ReturnType<typeof getLipiSourceIngestionContractsView>;
}) {
  return (
    <Panel title="Evidence Center" kicker="/lipi/evidence">
      <StatGrid rows={[["Sources", federation.sourceRegistry.summary.sources], ["Lineage Nodes", federation.lineageGraph.summary.nodes], ["Audit Failures", countFailureItems(audit.evidenceAudit.failures)], ["Trust Rows", contracts.trustMatrix.summary.sources]]} />
      <Rows rows={federation.sourceRegistry.sources.map((source) => [source.id, source.localStatus, source.trustedFor.join(", "), source.createsNewScriptClaims ? "CLAIMS" : "NO NEW CLAIMS"])} />
    </Panel>
  );
}

function FederationPanel({ federation }: { federation: ReturnType<typeof getLipiEvidenceFederationView> }) {
  return (
    <Panel title="Federation Layer" kicker="/lipi/federation">
      <StatGrid rows={[["Registered Sources", federation.sourceRegistry.summary.sources], ["Lineage Nodes", federation.lineageGraph.summary.nodes], ["Lineage Edges", federation.lineageGraph.summary.edges], ["Conflicts", federation.conflictDetector.summary.conflicts]]} />
      <Rows rows={federation.sourceRegistry.sources.map((source) => [source.id, source.sourceClass, source.localStatus, source.claimPolicy])} />
    </Panel>
  );
}

function IngestionPanel({
  contracts,
  dryRun,
  iso,
  cldr,
  icu,
  phase12To16,
}: {
  contracts: ReturnType<typeof getLipiSourceIngestionContractsView>;
  dryRun: ReturnType<typeof getLipiIngestionDryRunView>;
  iso: ReturnType<typeof getLipiIso15924IngestionView>;
  cldr: ReturnType<typeof getLipiCldrIngestionView>;
  icu: ReturnType<typeof getLipiIcuIngestionView>;
  phase12To16: ReturnType<typeof getLipiPhase12To16GovernanceView>;
}) {
  return (
    <Panel title="Ingestion Workspace" kicker="/lipi/ingestion">
      <StatGrid rows={[["Adapters", contracts.adapterContracts.summary.adapters], ["Dry Writes", dryRun.dryRunReport.dryRun.rowsWritten], ["ISO Blocked", iso.blockers.summary.blockers], ["CLDR Blocked", cldr.blockers.summary.blockers], ["ICU Blocked", icu.blockers.summary.blockers], ["HB/OT Blocked", phase12To16.phase12.blockers.summary.blockers]]} />
      <Rows rows={contracts.adapterContracts.adapters.map((adapter) => [adapter.sourceId, adapter.mode, adapter.writesRegistry ? "WRITES" : "NO WRITES", adapter.silentEnrichmentAllowed ? "SILENT" : "EXPLICIT"])} />
    </Panel>
  );
}

function RuntimeStatusPanel({ activation }: { activation: ReturnType<typeof getLipiRegistryRuntimeActivationView> }) {
  return (
    <Panel title="Runtime Status" kicker="/lipi/runtime-status" badgeText={activation.phkdVerdict}>
      <div className="lipi-full-status-callout">
        <strong>Controlled Preview Runtime Active</strong>
        <span>Production GO Blocked</span>
      </div>
      <StatGrid
        rows={[
          ["Registry Runtime Active", String(activation.registryRuntimeActive)],
          ["Runtime Mode", activation.runtimeMode],
          ["Read Only", String(activation.readOnly)],
          ["Mutation Allowed", String(activation.mutationAllowed)],
          ["Runtime Enabled Rows", activation.runtimeEnabledRows],
          ["Production Ready", String(activation.productionReady)],
          ["Production GO", String(activation.productionGoApproved)],
          ["Human Approval", String(activation.humanApprovalPresent)],
        ]}
      />
      <div className="lipi-full-feature-strip">
        <Badge text="runtime read-only" />
        <Badge text="row mutation disabled" tone="blocked" />
        <Badge text="enrichment auto-apply disabled" tone="blocked" />
        <Badge text="release candidate false" tone="blocked" />
      </div>
      <Rows
        rows={[
          ["Registry Mutation", activation.runtimePolicy.registryMutationAllowed ? "ALLOWED" : "DISABLED", "mutationAllowed=false", activation.sourcePolicy],
          ["Per-row Runtime", activation.runtimePolicy.rowRuntimeEnablementAllowed ? "ALLOWED" : "DISABLED", `runtimeEnabledRows=${activation.runtimeEnabledRows}`, "requires explicit row approval"],
          ["Enrichment Auto-Apply", activation.runtimePolicy.enrichmentAutoApplyAllowed ? "ALLOWED" : "DISABLED", `applied=${activation.enrichmentProposalsApplied}`, "proposal-only"],
          ["Production GO", activation.runtimePolicy.productionGoAllowed ? "ALLOWED" : "BLOCKED", `approved=${activation.productionGoApproved}`, "human approval missing"],
        ]}
      />
      <Rows rows={activation.blockers.map((blocker) => [blocker.id, blocker.severity, blocker.status, blocker.reason])} />
    </Panel>
  );
}

function RenderingValidationPanel({
  rendering,
  phase24To27,
}: {
  rendering: ReturnType<typeof getLipiRenderingValidationView>;
  phase24To27: ReturnType<typeof getLipiPhase24To27GovernanceView>;
}) {
  const crossBrowser = phase24To27.phase24.crossBrowserValidation;
  const crossPlatform = phase24To27.phase25.crossPlatformValidation;
  return (
    <Panel title="Rendering Validation" kicker="/lipi/rendering" badgeText={rendering.phkdVerdict}>
      <div className="lipi-full-status-callout">
        <strong>Rendering Corpus Present</strong>
        <span>Glyph baselines captured; cross-browser and cross-platform validation still blocked</span>
      </div>
      <StatGrid
        rows={[
          ["Corpus Records", rendering.corpus.summary.corpusRecords],
          ["UCD Sample Rows", rendering.corpus.summary.sampleRows],
          ["Digit Rows", rendering.corpus.summary.digitRows],
          ["Zero Rows", rendering.corpus.summary.zeroRows],
          ["Shaping Inputs", rendering.shapingEvidence.counts.sourceBackedShapingSamples],
          ["Browser Canvas", rendering.engineEvidence.browser.counts.canvasCapturedRows],
          ["Browser DOM", rendering.engineEvidence.browser.counts.domCapturedRows],
          ["OpenType Pipeline", rendering.engineEvidence.openType.counts.pipelineCapturedRows],
          ["HarfBuzz Verified", rendering.harfbuzzExecution.shapingEvidence.counts.verifiedRows],
          ["HB Failed Evidence", rendering.harfbuzzExecution.shapingEvidence.counts.failedWithEvidenceRows],
          ["Glyph Baselines", rendering.glyphBaselineEvidence.captures.counts.verifiedCaptureRows],
          ["Browser Atlas", rendering.glyphBaselineEvidence.captures.counts.browserAtlasImages],
          ["Render Diffs", rendering.glyphBaselineEvidence.renderDiff.counts.comparedRows],
          ["Fonts Measured", rendering.glyphBaselineEvidence.fontCoverage.counts.fontsUsed],
          ["Browsers Verified", `${crossBrowser.summary.verifiedBrowsers}/${crossBrowser.summary.targetBrowsers}`],
          ["Platforms Verified", `${crossPlatform.summary.verifiedPlatforms}/${crossPlatform.summary.targetPlatforms}`],
          ["Font Fixtures", rendering.fontFixtures.summary.fixtureCount],
          ["Runtime Enabled", rendering.runtimeEnabledRows],
        ]}
      />
      <div className="lipi-full-feature-strip">
        <Badge text="expectedGlyphCount=null" />
        <Badge text="no inferred glyph expectations" />
        <Badge text="no registry mutation" tone="blocked" />
        <Badge text="production blocked" tone="blocked" />
      </div>
      <Rows rows={rendering.renderingEvidence.targets.map((target) => [target.target, target.state, target.evidence, target.claim])} />
      <Rows
        rows={[
          ["HarfBuzz Environment", rendering.harfbuzzExecution.environment.status, rendering.harfbuzzExecution.environment.harfbuzz.selectedPath, rendering.harfbuzzExecution.environment.harfbuzz.version],
          ["HarfBuzz Shaping", rendering.harfbuzzExecution.shapingEvidence.status, `verified=${rendering.harfbuzzExecution.shapingEvidence.counts.verifiedRows}`, `failed=${rendering.harfbuzzExecution.shapingEvidence.counts.failedWithEvidenceRows}`],
          ["Browser DOM", "CAPTURED", `rows=${rendering.engineEvidence.browser.counts.domCapturedRows}`, rendering.engineEvidence.browser.engine.version],
          ["Browser Canvas", "CAPTURED", `rows=${rendering.engineEvidence.browser.counts.canvasCapturedRows}`, rendering.engineEvidence.browser.engine.userAgent],
          ["OpenType Pipeline", "CAPTURED", `rows=${rendering.engineEvidence.openType.counts.pipelineCapturedRows}`, `css=${String(rendering.engineEvidence.openType.engine.cssSupports.fontFeatureSettings)}`],
          ["Glyph Baseline Capture", rendering.glyphBaselineEvidence.captures.status, `rows=${rendering.glyphBaselineEvidence.captures.counts.captureRows}`, `hashes=${rendering.glyphBaselineEvidence.captures.counts.stableBaselineHashRows}`],
          ["Browser Atlas", rendering.glyphBaselineEvidence.captures.browserAtlas.capture.status, `rows=${rendering.glyphBaselineEvidence.captures.browserAtlas.rowCount}`, rendering.glyphBaselineEvidence.captures.browserAtlas.imagePath],
          ["Render Diff", rendering.glyphBaselineEvidence.renderDiff.status, `comparisons=${rendering.glyphBaselineEvidence.renderDiff.counts.browserVsHarfBuzzComparisons}`, "no direct hash-equivalence claim"],
          ["Font Coverage", rendering.glyphBaselineEvidence.fontCoverage.status, `fonts=${rendering.glyphBaselineEvidence.fontCoverage.counts.fontsUsed}`, `failed=${rendering.glyphBaselineEvidence.fontCoverage.counts.failedWithEvidenceRows}`],
          ["Cross Browser", crossBrowser.status, `verified=${crossBrowser.summary.verifiedBrowsers}`, `blocked=${crossBrowser.summary.blockedBrowsers}`],
          ["Cross Platform", crossPlatform.status, `verified=${crossPlatform.summary.verifiedPlatforms}`, `blocked=${crossPlatform.summary.blockedPlatforms}`],
        ]}
      />
      <Rows
        rows={[
          ["Font Fixtures", rendering.fontEvidence.status, String(rendering.fontEvidence.counts.fixtureCount), rendering.fontFixtures.blockers[0]?.reason ?? "UNKNOWN"],
          ["Glyph Baseline Manifest", rendering.shapingEvidence.status, String(rendering.shapingEvidence.counts.glyphBaselines), rendering.glyphBaselines.blockers[0]?.reason ?? "UNKNOWN"],
          ["Production Ready", String(rendering.productionReady), "governedProductionGo=false", rendering.phkdVerdict],
        ]}
      />
    </Panel>
  );
}

function GovernancePanel({
  phase12To16,
  phase17To19,
  phase24To27,
}: {
  phase12To16: ReturnType<typeof getLipiPhase12To16GovernanceView>;
  phase17To19: ReturnType<typeof getLipiPhase17To19GovernanceView>;
  phase24To27: ReturnType<typeof getLipiPhase24To27GovernanceView>;
}) {
  const gate = phase17To19.phase19.productionGoGate;
  const decision = phase24To27.phase27.productionGoDecision;
  return (
    <Panel title="Governance Workspace" kicker="/lipi/governance">
      <StatGrid rows={[["Runtime Enabled", gate.summary.runtimeEnabled], ["Production Ready", String(decision.summary.productionReady)], ["Human Approval", String(decision.summary.humanApprovalPresent)], ["Production Blockers", decision.summary.activeProductionGoBlockers]]} />
      <Rows rows={phase12To16.phase15.gateReview.criteria.map((criterion) => [criterion.label, criterion.status, criterion.blocksEnablement ? "BLOCKS" : "CLEAR", criterion.evidence])} />
      <Rows rows={[
        ["Phase 24 Cross Browser", phase24To27.phase24.crossBrowserValidation.status, `verified=${phase24To27.phase24.crossBrowserValidation.summary.verifiedBrowsers}`, `blocked=${phase24To27.phase24.crossBrowserValidation.summary.blockedBrowsers}`],
        ["Phase 25 Cross Platform", phase24To27.phase25.crossPlatformValidation.status, `verified=${phase24To27.phase25.crossPlatformValidation.summary.verifiedPlatforms}`, `blocked=${phase24To27.phase25.crossPlatformValidation.summary.blockedPlatforms}`],
        ["Phase 26 Human Approval", phase24To27.phase26.externalReviewHumanApproval.status, `approval=${String(phase24To27.phase26.externalReviewHumanApproval.summary.validSignedHumanApproval)}`, `review=${String(phase24To27.phase26.externalReviewHumanApproval.summary.externalReviewComplete)}`],
        ["Phase 27 Production Decision", decision.decision, decision.status, `blockers=${decision.summary.activeProductionGoBlockers}`],
      ]} />
    </Panel>
  );
}

function ReviewPanel({
  phase17To19,
  phase24To27,
}: {
  phase17To19: ReturnType<typeof getLipiPhase17To19GovernanceView>;
  phase24To27: ReturnType<typeof getLipiPhase24To27GovernanceView>;
}) {
  const review = phase17To19.phase18.externalReviewPackage;
  const approval = phase24To27.phase26.externalReviewHumanApproval;
  return (
    <Panel title="Review Workspace" kicker="/lipi/review">
      <StatGrid rows={[["Runbook Steps", phase17To19.phase17.operatorRunbook.summary.runSequenceSteps], ["Review Status", review.reviewPackage.status], ["Signoffs", approval.summary.reviewerSignoffs], ["Human Approval", String(approval.summary.validSignedHumanApproval)]]} />
      <Rows rows={phase17To19.phase17.operatorRunbook.runSequence.map((step) => [String(step.order), step.title, step.command, step.expectedResult])} />
      <Rows rows={approval.blockers.map((blocker) => [blocker.id, blocker.severity, blocker.status, blocker.reason])} />
    </Panel>
  );
}

function AuditPanel({
  audit,
  federation,
}: {
  audit: ReturnType<typeof getLipiRegistryAuditabilityView>;
  federation: ReturnType<typeof getLipiEvidenceFederationView>;
}) {
  return (
    <Panel title="Audit Workspace" kicker="/lipi/audit">
      <StatGrid rows={[["Audit Failures", countFailureItems(audit.evidenceAudit.failures)], ["Orphan Evidence", audit.provenance.counts.orphanEvidenceReferences], ["Missing Provenance", audit.provenance.counts.nodesMissingProvenance], ["Source Conflicts", federation.conflictDetector.summary.conflicts]]} />
      <Rows rows={audit.exportCenter.outputHashes.map((artifact) => [artifact.path, artifact.sha256.slice(0, 18), "HASHED", "EXPORT"])} />
    </Panel>
  );
}

function ExportPanel({
  audit,
  phase12To16,
  phase17To19,
}: {
  audit: ReturnType<typeof getLipiRegistryAuditabilityView>;
  phase12To16: ReturnType<typeof getLipiPhase12To16GovernanceView>;
  phase17To19: ReturnType<typeof getLipiPhase17To19GovernanceView>;
}) {
  return (
    <Panel title="Export Center" kicker="/lipi/export">
      <StatGrid rows={[["Exports", audit.exportCenter.outputHashes.length], ["RC Artifacts", phase12To16.phase16.evidenceBundle.summary.indexedArtifacts], ["Review Artifacts", phase17To19.phase18.externalReviewPackage.summary.artifacts], ["Production", String(phase17To19.phase19.productionGoGate.summary.productionReady)]]} />
      <Rows rows={[...audit.exportCenter.outputHashes.map((artifact) => [artifact.path, artifact.sha256.slice(0, 18), "EXPORT", "READY"]), ...phase17To19.phase18.externalReviewPackage.reviewPackage.artifacts.slice(0, 6).map((artifact) => [artifact.path, artifact.sha256.slice(0, 18), "REVIEW", "PENDING"])]} />
    </Panel>
  );
}

function ReleasePanel({
  phase12To16,
  phase17To19,
  phase24To27,
}: {
  phase12To16: ReturnType<typeof getLipiPhase12To16GovernanceView>;
  phase17To19: ReturnType<typeof getLipiPhase17To19GovernanceView>;
  phase24To27: ReturnType<typeof getLipiPhase24To27GovernanceView>;
}) {
  const bundle = phase12To16.phase16.evidenceBundle;
  const gate = phase17To19.phase19.productionGoGate;
  const decision = phase24To27.phase27.productionGoDecision;
  return (
    <Panel title="Release Center" kicker="/lipi/release">
      <StatGrid rows={[["Release Candidate", String(decision.summary.releaseCandidate)], ["Production Ready", String(decision.summary.productionReady)], ["Runtime Enabled", decision.summary.runtimeEnabledRows], ["Decision", decision.decision]]} />
      <Rows rows={[...gate.blockers, ...decision.blockers].map((blocker) => [blocker.id, blocker.severity, blocker.status, blocker.reason])} />
    </Panel>
  );
}

function ApiPanel({ sources }: { sources: ReturnType<typeof getLipiRegistrySourceSummary> }) {
  return (
    <Panel title="API" kicker="/lipi/api">
      <StatGrid rows={[["Contracts", sources.contracts.length], ["Schemas", Object.keys(sources.phase3Schemas).length], ["Policies", Object.keys(sources).filter((key) => key.endsWith("SourcePolicy")).length], ["Production", String(sources.productionReady)]]} />
      <Rows rows={sources.contracts.map((contract) => [contract.method, contract.path, contract.handler, contract.status])} />
    </Panel>
  );
}

function Panel({ title, kicker, children, badgeText = "CONTROLLED_NO_GO" }: { title: string; kicker: string; children: ReactNode; badgeText?: string }) {
  const workspace = lipiFullWorkspaces.find((item) => item.title === title || item.label === title);
  return (
    <section className="lipi-full-panel" aria-label={title}>
      <header>
        <div>
          <p className="dashboard-kicker">{kicker}</p>
          <h3>{title}</h3>
          {workspace ? <p>{workspace.summary}</p> : null}
        </div>
        <Badge text={badgeText} tone="blocked" />
      </header>
      {workspace ? <FeatureStrip features={workspace.features} /> : null}
      {children}
    </section>
  );
}

function FeatureStrip({ features }: { features: string[] }) {
  return (
    <div className="lipi-full-feature-strip">
      {features.map((feature) => (
        <Badge key={feature} text={feature} />
      ))}
    </div>
  );
}

function RecordGrid({
  records,
  navigate,
}: {
  records: ReturnType<typeof listLipiRegistryScripts>["records"];
  navigate: (route: string) => void;
}) {
  return (
    <div className="lipi-full-record-grid">
      {records.map((record) => (
        <button key={record.id} onClick={() => navigate(`/lipi/script/${record.id}`)}>
          <span>{record.registry_index.toString().padStart(3, "0")}</span>
          <strong>{record.display_name}</strong>
          <small>{record.id}</small>
          <em>{record.registry_class} / {record.iso15924}</em>
        </button>
      ))}
    </div>
  );
}

function StatGrid({ rows }: { rows: Array<[string, number | string]> }) {
  return (
    <div className="lipi-full-metrics compact">
      {rows.map(([label, value]) => (
        <Metric key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function Rows({ rows }: { rows: Array<Array<string | number>> }) {
  return (
    <div className="lipi-full-table">
      {rows.map((row, index) => (
        <article key={`${row.join(":")}:${index}`}>
          {row.map((cell, cellIndex) => (cellIndex === 0 ? <strong key={cellIndex}>{cell}</strong> : <span key={cellIndex}>{cell}</span>))}
        </article>
      ))}
    </div>
  );
}

function countFailureItems(failures: Record<string, readonly unknown[]>): number {
  return Object.values(failures).reduce((sum, items) => sum + items.length, 0);
}

function Info({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <article className="lipi-full-info">
      <h4>{title}</h4>
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="lipi-full-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "blocked" }) {
  return <span className={`lipi-full-badge ${tone}`}>{text}</span>;
}
