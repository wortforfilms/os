import { useMemo, useState } from "react";
import {
  getLipiCldrIngestionView,
  getLipiEvidenceBadges,
  getLipiEvidenceFederationView,
  getLipiFamilyGraphView,
  getLipiIngestionDryRunView,
  getLipiIso15924IngestionView,
  getLipiKbsGraphView,
  getLipiNumeralZeroView,
  getLipiPhase3ScriptEnrichment,
  getLipiRegistryAuditabilityView,
  getLipiRegistryScript,
  getLipiRegistrySourceSummary,
  getLipiScriptKbsNeighborhood,
  getLipiSourceIngestionContractsView,
  getLipiUnicodeCrosswalk,
  getLipiZeroRegistryView,
  listLipiRegistryScripts,
  type LipiRegistryBadge,
} from "./api";

type LipiRegistryPageProps = {
  route: string;
  navigate: (route: string) => void;
};

const registryClasses = ["all", "unicode", "undeciphered", "shorthand", "notation", "symbol", "hkd_private"] as const;
const unicodeStatuses = ["all", "encoded", "partially_encoded", "unencoded", "proposed", "private"] as const;
const evidenceStatuses = ["all", "verified", "scholarly", "disputed", "draft", "unknown"] as const;
type ExplorerId =
  | "numerals"
  | "zero"
  | "family"
  | "crosswalk"
  | "kbs"
  | "export"
  | "audit"
  | "provenance"
  | "validator"
  | "diff"
  | "federation-sources"
  | "lineage"
  | "conflicts"
  | "chains"
  | "adapter-contracts"
  | "ingestion-policy"
  | "trust-matrix"
  | "conflict-rules"
  | "dry-run"
  | "field-diff"
  | "ingestion-blockers"
  | "iso15924-report"
  | "iso15924-crosswalk"
  | "iso15924-diff"
  | "iso15924-blockers"
  | "cldr-report"
  | "cldr-crosswalk"
  | "cldr-diff"
  | "cldr-blockers";

export function LipiRegistryPage({ route, navigate }: LipiRegistryPageProps) {
  const selectedId = route.startsWith("/lipi-registry/") ? decodeURIComponent(route.replace("/lipi-registry/", "")) : null;
  const [query, setQuery] = useState("");
  const [registryClass, setRegistryClass] = useState<(typeof registryClasses)[number]>("all");
  const [unicodeStatus, setUnicodeStatus] = useState<(typeof unicodeStatuses)[number]>("all");
  const [evidenceStatus, setEvidenceStatus] = useState<(typeof evidenceStatuses)[number]>("all");
  const [explorer, setExplorer] = useState<ExplorerId>("numerals");
  const list = useMemo(
    () => listLipiRegistryScripts({ q: query, registryClass, unicodeStatus, evidenceStatus, limit: 120 }),
    [query, registryClass, unicodeStatus, evidenceStatus],
  );
  const detail = selectedId ? getLipiRegistryScript(selectedId) : null;
  const numeralView = useMemo(() => getLipiNumeralZeroView(), []);
  const zeroView = useMemo(() => getLipiZeroRegistryView(), []);
  const familyView = useMemo(() => getLipiFamilyGraphView(), []);
  const crosswalkView = useMemo(() => getLipiUnicodeCrosswalk(), []);
  const kbsView = useMemo(() => getLipiKbsGraphView(), []);
  const auditabilityView = useMemo(() => getLipiRegistryAuditabilityView(), []);
  const federationView = useMemo(() => getLipiEvidenceFederationView(), []);
  const ingestionContractsView = useMemo(() => getLipiSourceIngestionContractsView(), []);
  const dryRunView = useMemo(() => getLipiIngestionDryRunView(), []);
  const iso15924View = useMemo(() => getLipiIso15924IngestionView(), []);
  const cldrView = useMemo(() => getLipiCldrIngestionView(), []);
  const sources = useMemo(() => getLipiRegistrySourceSummary(), []);

  return (
    <section className="lipi-registry-shell" aria-label="HKD Lipi registry">
      <header className="lipi-registry-hero">
        <div>
          <p className="dashboard-kicker">HKD Lipi Registry</p>
          <h2>426-row writing-system registry.</h2>
        </div>
        <div className="lipi-registry-gate">
          <strong>{list.reviewState}</strong>
          <span>runtime enabled: {list.stats.runtimeEnabled}</span>
        </div>
      </header>

      <div className="lipi-stat-grid" aria-label="Registry stats">
        <RegistryStat label="Rows" value={list.stats.total} />
        <RegistryStat label="Unicode Rows" value={list.stats.byClass.unicode ?? 0} />
        <RegistryStat label="Decimal Scripts" value={numeralView.summary.rowsWithDigitInventory} />
        <RegistryStat label="Zero Glyphs" value={zeroView.summary.zeroGlyphScripts} />
        <RegistryStat label="Crosswalk Ranges" value={list.stats.rowsWithUnicodeRanges} />
        <RegistryStat label="Runtime On" value={list.stats.runtimeEnabled} />
        <RegistryStat label="KBS Nodes" value={list.stats.kbsNodes} />
        <RegistryStat label="KBS Edges" value={list.stats.kbsEdges} />
      </div>

      <div className="lipi-registry-controls" aria-label="Registry controls">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scripts, ISO, blocks, evidence..." />
        <select value={registryClass} onChange={(event) => setRegistryClass(event.target.value as (typeof registryClasses)[number])}>
          {registryClasses.map((value) => (
            <option key={value} value={value}>
              class: {value}
            </option>
          ))}
        </select>
        <select value={unicodeStatus} onChange={(event) => setUnicodeStatus(event.target.value as (typeof unicodeStatuses)[number])}>
          {unicodeStatuses.map((value) => (
            <option key={value} value={value}>
              unicode: {value}
            </option>
          ))}
        </select>
        <select value={evidenceStatus} onChange={(event) => setEvidenceStatus(event.target.value as (typeof evidenceStatuses)[number])}>
          {evidenceStatuses.map((value) => (
            <option key={value} value={value}>
              evidence: {value}
            </option>
          ))}
        </select>
      </div>

      <div className="lipi-explorer-tabs" aria-label="Registry explorers">
        {[
          ["numerals", "Numeral Explorer"],
          ["zero", "Zero Registry"],
          ["family", "Family Tree"],
          ["crosswalk", "Unicode Crosswalk"],
          ["kbs", "KBS Graph"],
          ["export", "Export Center"],
          ["audit", "Evidence Audit Viewer"],
          ["provenance", "Provenance Explorer"],
          ["validator", "Node/Edge Validator"],
          ["diff", "Registry Diff Viewer"],
          ["federation-sources", "Source Registry"],
          ["lineage", "Evidence Lineage"],
          ["conflicts", "Source Conflicts"],
          ["chains", "Provenance Chains"],
          ["adapter-contracts", "Adapter Contracts"],
          ["ingestion-policy", "Ingestion Policy"],
          ["trust-matrix", "Trust Matrix"],
          ["conflict-rules", "Conflict Rules"],
          ["dry-run", "Dry-Run Harness"],
          ["field-diff", "Field Diff Preview"],
          ["ingestion-blockers", "Ingestion Blockers"],
          ["iso15924-report", "ISO 15924 Report"],
          ["iso15924-crosswalk", "ISO 15924 Crosswalk"],
          ["iso15924-diff", "ISO 15924 Diff"],
          ["iso15924-blockers", "ISO 15924 Blockers"],
          ["cldr-report", "CLDR Report"],
          ["cldr-crosswalk", "CLDR Crosswalk"],
          ["cldr-diff", "CLDR Diff"],
          ["cldr-blockers", "CLDR Blockers"],
        ].map(([id, label]) => (
          <button className={explorer === id ? "active" : ""} key={id} onClick={() => setExplorer(id as ExplorerId)}>
            {label}
          </button>
        ))}
      </div>

      {explorer === "numerals" ? <NumeralZeroPanel view={numeralView} /> : null}
      {explorer === "zero" ? <ZeroRegistryPanel view={zeroView} /> : null}
      {explorer === "family" ? <FamilyTreePanel view={familyView} /> : null}
      {explorer === "crosswalk" ? <UnicodeCrosswalkPanel view={crosswalkView} /> : null}
      {explorer === "kbs" ? <KbsGraphPanel view={kbsView} /> : null}
      {explorer === "export" ? <ExportCenterPanel view={auditabilityView} /> : null}
      {explorer === "audit" ? <EvidenceAuditPanel view={auditabilityView} /> : null}
      {explorer === "provenance" ? <ProvenanceExplorerPanel view={auditabilityView} /> : null}
      {explorer === "validator" ? <NodeEdgeValidatorPanel view={auditabilityView} /> : null}
      {explorer === "diff" ? <RegistryDiffPanel view={auditabilityView} /> : null}
      {explorer === "federation-sources" ? <FederatedSourceRegistryPanel view={federationView} /> : null}
      {explorer === "lineage" ? <EvidenceLineagePanel view={federationView} /> : null}
      {explorer === "conflicts" ? <SourceConflictPanel view={federationView} /> : null}
      {explorer === "chains" ? <ProvenanceChainPanel view={federationView} /> : null}
      {explorer === "adapter-contracts" ? <AdapterContractsPanel view={ingestionContractsView} /> : null}
      {explorer === "ingestion-policy" ? <IngestionPolicyPanel view={ingestionContractsView} /> : null}
      {explorer === "trust-matrix" ? <SourceTrustMatrixPanel view={ingestionContractsView} /> : null}
      {explorer === "conflict-rules" ? <ConflictRulesPanel view={ingestionContractsView} /> : null}
      {explorer === "dry-run" ? <DryRunHarnessPanel view={dryRunView} /> : null}
      {explorer === "field-diff" ? <FieldDiffPreviewPanel view={dryRunView} /> : null}
      {explorer === "ingestion-blockers" ? <IngestionBlockersPanel view={dryRunView} /> : null}
      {explorer === "iso15924-report" ? <Iso15924ReportPanel view={iso15924View} /> : null}
      {explorer === "iso15924-crosswalk" ? <Iso15924CrosswalkPanel view={iso15924View} /> : null}
      {explorer === "iso15924-diff" ? <Iso15924DiffPanel view={iso15924View} /> : null}
      {explorer === "iso15924-blockers" ? <Iso15924BlockersPanel view={iso15924View} /> : null}
      {explorer === "cldr-report" ? <CldrReportPanel view={cldrView} /> : null}
      {explorer === "cldr-crosswalk" ? <CldrCrosswalkPanel view={cldrView} /> : null}
      {explorer === "cldr-diff" ? <CldrDiffPanel view={cldrView} /> : null}
      {explorer === "cldr-blockers" ? <CldrBlockersPanel view={cldrView} /> : null}

      {detail ? (
        detail.ok ? (
          <ScriptDetail detail={detail} navigate={navigate} />
        ) : (
          <section className="lipi-detail-panel blocked">
            <strong>{detail.error}</strong>
            <p>{detail.id}</p>
            <button onClick={() => navigate("/lipi-registry")}>Back to Registry</button>
          </section>
        )
      ) : null}

      <section className="lipi-result-panel" aria-label="Registry results">
        <header>
          <h3>{list.total} matched</h3>
          <span>{list.returned} shown</span>
        </header>
        <div className="lipi-result-list">
          {list.records.map((record) => (
            <article className="lipi-result-row" key={record.id}>
              <button className="lipi-row-main" onClick={() => navigate(`/lipi-registry/${encodeURIComponent(record.id)}`)}>
                <span>{record.registry_index.toString().padStart(3, "0")}</span>
                <strong>{record.display_name}</strong>
                <em>{record.id}</em>
              </button>
              <div className="lipi-row-meta">
                <Badge label="class" value={record.registry_class} tone="neutral" />
                <Badge label="unicode" value={record.unicode_status} tone={record.unicode_status === "encoded" ? "verified" : record.unicode_status === "unencoded" ? "blocked" : "draft"} />
                <Badge label="evidence" value={record.evidence_status} tone={record.evidence_status === "verified" ? "verified" : record.evidence_status === "unknown" ? "unknown" : "draft"} />
                <Badge label="ISO" value={record.iso15924} tone={record.iso15924 === "UNKNOWN" ? "unknown" : "verified"} />
              </div>
              <div className="lipi-row-blocks">{record.unicode_blocks.length ? record.unicode_blocks.slice(0, 3).join(" / ") : "NO VERIFIED BLOCK"}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="lipi-contract-panel" aria-label="Local API contracts">
        <h3>Local API Contracts</h3>
        <div className="lipi-contract-grid">
          {sources.contracts.map((contract) => (
            <code key={contract.path}>
              {contract.method} {contract.path}
            </code>
          ))}
        </div>
      </section>
    </section>
  );
}

function ScriptDetail({
  detail,
  navigate,
}: {
  detail: Extract<ReturnType<typeof getLipiRegistryScript>, { ok: true }>;
  navigate: (route: string) => void;
}) {
  const { record } = detail;
  const phase3 = getLipiPhase3ScriptEnrichment(record);
  const kbs = getLipiScriptKbsNeighborhood(record.id);
  const phase3Digits = phase3.numeral?.digits_0_9 ?? [];
  const phase3Blocks = phase3.crosswalk?.unicodeBlocks ?? [];
  return (
    <section className="lipi-detail-panel" aria-label="Script detail">
      <header>
        <div>
          <p className="dashboard-kicker">Script Detail</p>
          <h3>{record.display_name}</h3>
          <span>{record.id}</span>
        </div>
        <button onClick={() => navigate("/lipi-registry")}>Back</button>
      </header>
      <div className="lipi-badge-strip">
        {detail.badges.map((badge) => (
          <Badge key={`${badge.label}:${badge.value}`} {...badge} />
        ))}
      </div>
      <div className="lipi-detail-grid">
        <DetailBlock
          title="Unicode"
          rows={[
            ["Script value", record.unicode_script_value],
            ["Alias / ISO", `${record.unicode_script_alias} / ${record.iso15924}`],
            ["Version", record.unicode_version_added],
            ["Property kind", record.script_property_kind],
            ["Ranges", record.unicode_ranges.length ? record.unicode_ranges.join(", ") : "UNKNOWN"],
            ["Blocks", record.unicode_blocks.length ? record.unicode_blocks.join(", ") : "UNKNOWN"],
          ]}
        />
        <DetailBlock
          title="Writing"
          rows={[
            ["Class", record.registry_class],
            ["Family", record.script_family],
            ["Type", record.writing_system_type],
            ["Direction", record.direction],
            ["Joining", record.joining_behavior],
            ["Casing", record.casing_behavior],
          ]}
        />
        <DetailBlock
          title="Numeral / Zero"
          rows={[
            ["Has decimal digits", phase3.numeral ? "true" : "UNKNOWN"],
            ["Zero glyph", phase3.zero?.zeroGlyph ?? "UNKNOWN"],
            ["Zero code point", phase3.zero?.zeroCodePoint ?? "UNKNOWN"],
            ["Digits", phase3Digits.length ? phase3Digits.map((digit) => digit.glyph).join(" ") : "UNKNOWN"],
          ]}
        />
        <DetailBlock
          title="Phase 3 UCD"
          rows={[
            ["UCD ranges", phase3.crosswalk?.unicodeRanges.length ? phase3.crosswalk.unicodeRanges.length.toString() : "UNKNOWN"],
            ["UCD blocks", phase3Blocks.length ? phase3Blocks.map((block) => block.blockName).slice(0, 4).join(", ") : "UNKNOWN"],
            ["Font support", phase3.crosswalk?.fontSupportMetadata.status ?? "UNKNOWN"],
            ["Transliteration", phase3.crosswalk?.transliterationMetadata.status ?? "UNKNOWN"],
          ]}
        />
        <DetailBlock
          title="Evidence"
          rows={[
            ["Evidence", record.evidence_status],
            ["Runtime", record.hkd_runtime_enabled ? "ENABLED" : "DISABLED"],
            ["Sources", record.source_refs.join(", ")],
            ["Provenance", record.provenance.stance],
          ]}
        />
        <DetailBlock
          title="Blocked Fields"
          rows={(kbs?.blockedFields ?? []).map((field) => [field.field, `${field.status}: ${field.reason}`])}
        />
      </div>
      <div className="lipi-contract-grid compact">
        {detail.apiLinks.map((link) => (
          <code key={link.path}>{link.label}</code>
        ))}
      </div>
      {kbs ? <ScriptGraphNeighborhood graph={kbs} /> : null}
      {detail.relatedRecords.length ? (
        <div className="lipi-related">
          <h4>Related family rows</h4>
          {detail.relatedRecords.map((related) => (
            <button key={related.id} onClick={() => navigate(`/lipi-registry/${encodeURIComponent(related.id)}`)}>
              {related.display_name}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function KbsGraphPanel({ view }: { view: ReturnType<typeof getLipiKbsGraphView> }) {
  const edgeRows = view.edges.slice(0, 96);
  const nodeTypeRows = Object.entries(view.summary.nodeTypes);
  const edgeTypeRows = Object.entries(view.summary.edgeTypes);
  return (
    <section className="lipi-numeral-panel" aria-label="KBS graph explorer">
      <header>
        <h3>KBS Graph Explorer</h3>
        <Badge label="nodes" value={String(view.summary.totalNodes)} tone="verified" />
        <Badge label="edges" value={String(view.summary.totalEdges)} tone="verified" />
        <Badge label="PHKD" value={view.phkdVerdict} tone="blocked" />
      </header>
      <div className="lipi-graph-summary" aria-label="KBS graph summary cards">
        <RegistryStat label="Script Nodes" value={view.summary.scriptNodes} />
        <RegistryStat label="Unicode Scripts" value={view.summary.unicodeScriptNodes} />
        <RegistryStat label="Digit Nodes" value={view.summary.decimalDigitInventories} />
        <RegistryStat label="Zero Nodes" value={view.summary.zeroGlyphNodes} />
        <RegistryStat label="Runtime On" value={view.summary.runtimeEnabledRows} />
        <RegistryStat label="Evidence Sources" value={view.summary.evidenceSourceNodes} />
      </div>
      <div className="lipi-kbs-columns">
        <div className="lipi-kbs-card">
          <h4>Node Types</h4>
          {nodeTypeRows.map(([label, count]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        <div className="lipi-kbs-card">
          <h4>Edge Types</h4>
          {edgeTypeRows.map(([label, count]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="lipi-blocked-grid" aria-label="Blocked graph fields">
        {view.summary.blockedFields.map((field) => (
          <article key={field.field}>
            <strong>{field.field}</strong>
            <Badge label="status" value={field.status} tone={field.status === "UNKNOWN" ? "unknown" : "blocked"} />
            <p>{field.reason}</p>
          </article>
        ))}
      </div>
      <div className="lipi-result-list small">
        {edgeRows.map((edge) => (
          <article className="lipi-result-row" key={edge.id}>
            <div className="lipi-row-main static">
              <span>-&gt;</span>
              <strong>{edge.type}</strong>
              <em>{edge.fields.registry_id ?? edge.fields.script_value ?? "graph"}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="from" value={edge.from.replace("kbs:", "")} tone="neutral" />
              <Badge label="to" value={edge.to.replace("kbs:", "")} tone="neutral" />
            </div>
            <div className="lipi-row-blocks">{edge.sourceRefs.join(", ")}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScriptGraphNeighborhood({ graph }: { graph: NonNullable<ReturnType<typeof getLipiScriptKbsNeighborhood>> }) {
  const nodeById = new Map(graph.neighbors.map((node) => [node.id, node]));
  return (
    <div className="lipi-kbs-neighborhood" aria-label="Script detail graph neighborhood">
      <header>
        <h4>KBS Graph Neighborhood</h4>
        <Badge label="edges" value={String(graph.summary.edgeCount)} tone="verified" />
        <Badge label="neighbors" value={String(graph.summary.neighborCount)} tone="verified" />
      </header>
      <div className="lipi-result-list small">
        {graph.edges.slice(0, 32).map((edge) => {
          const neighborId = edge.from === graph.record.kbs_node_id ? edge.to : edge.from;
          const neighbor = nodeById.get(neighborId);
          return (
            <article className="lipi-result-row" key={edge.id}>
              <div className="lipi-row-main static">
                <span>-&gt;</span>
                <strong>{edge.type}</strong>
                <em>{neighbor?.type ?? "KBS"}</em>
              </div>
              <div className="lipi-row-meta">
                <Badge label="neighbor" value={neighbor?.label ?? neighborId} tone="neutral" />
              </div>
              <div className="lipi-row-blocks">{edge.sourceRefs.join(", ")}</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ExportCenterPanel({ view }: { view: ReturnType<typeof getLipiRegistryAuditabilityView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Export Center">
      <header>
        <h3>Export Center</h3>
        <Badge label="artifacts" value={String(view.exportCenter.outputHashes.length)} tone="verified" />
        <Badge label="production" value={String(view.productionReady)} tone="blocked" />
        <Badge label="PHKD" value={view.phkdVerdict} tone="blocked" />
      </header>
      <div className="lipi-result-list small">
        {view.exportCenter.outputHashes.map((artifact) => (
          <article className="lipi-result-row" key={artifact.path}>
            <div className="lipi-row-main static">
              <span>{artifact.format.toUpperCase()}</span>
              <strong>{artifact.path}</strong>
              <em>{artifact.rows} rows</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="bytes" value={String(artifact.bytes)} tone="neutral" />
              <Badge label="sha256" value={artifact.sha256.slice(0, 16)} tone="verified" />
            </div>
            <div className="lipi-row-blocks">{artifact.sha256}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidenceAuditPanel({ view }: { view: ReturnType<typeof getLipiRegistryAuditabilityView> }) {
  const booleanChecks = Object.entries(view.evidenceAudit.checks).filter(([, value]) => typeof value === "boolean");
  const failureCounts = Object.entries(view.evidenceAudit.failures).map(([label, value]) => [label, Array.isArray(value) ? value.length : 0] as const);
  return (
    <section className="lipi-numeral-panel" aria-label="Evidence Audit Viewer">
      <header>
        <h3>Evidence Audit Viewer</h3>
        <Badge label="schema" value={view.evidenceAudit.schema} tone="neutral" />
        <Badge label="production" value={String(view.productionReady)} tone="blocked" />
      </header>
      <div className="lipi-graph-summary">
        <RegistryStat label="Seed Rows" value={view.evidenceAudit.inputCounts.seedRecords} />
        <RegistryStat label="Graph Nodes" value={view.evidenceAudit.inputCounts.graphNodes} />
        <RegistryStat label="Graph Edges" value={view.evidenceAudit.inputCounts.graphEdges} />
        <RegistryStat label="Failures" value={failureCounts.reduce((sum, [, count]) => sum + count, 0)} />
      </div>
      <div className="lipi-kbs-columns">
        <div className="lipi-kbs-card">
          <h4>Audit Checks</h4>
          {booleanChecks.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <Badge label="check" value={String(value)} tone={value ? "verified" : "blocked"} />
            </div>
          ))}
        </div>
        <div className="lipi-kbs-card">
          <h4>Failure Buckets</h4>
          {failureCounts.map(([label, count]) => (
            <div key={label}>
              <span>{label}</span>
              <Badge label="count" value={String(count)} tone={count === 0 ? "verified" : "blocked"} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProvenanceExplorerPanel({ view }: { view: ReturnType<typeof getLipiRegistryAuditabilityView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Provenance Explorer">
      <header>
        <h3>Provenance Explorer</h3>
        <Badge label="sources" value={String(view.provenance.counts.evidenceSources)} tone="verified" />
        <Badge label="orphans" value={String(view.provenance.counts.orphanEvidenceReferences)} tone={view.provenance.counts.orphanEvidenceReferences === 0 ? "verified" : "blocked"} />
        <Badge label="unreachable" value={String(view.provenance.counts.nodesUnreachableFromProvenance)} tone={view.provenance.counts.nodesUnreachableFromProvenance === 0 ? "verified" : "blocked"} />
        <Badge label="production" value={String(view.productionReady)} tone="blocked" />
      </header>
      <div className="lipi-result-list small">
        {view.provenance.evidenceSources.map((source) => (
          <article className="lipi-result-row" key={source.sourceId}>
            <div className="lipi-row-main static">
              <span>{source.nodeReferences}</span>
              <strong>{source.sourceId}</strong>
              <em>{source.nodeId}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="node refs" value={String(source.nodeReferences)} tone="verified" />
              <Badge label="edge refs" value={String(source.edgeReferences)} tone="verified" />
            </div>
            <div className="lipi-row-blocks">{source.sampleNodeIds.slice(0, 5).join(", ")}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NodeEdgeValidatorPanel({ view }: { view: ReturnType<typeof getLipiRegistryAuditabilityView> }) {
  const checks = [
    ["Every node reachable from provenance", view.validator.checks.everyNodeReachableFromProvenance],
    ["No orphan evidence references", view.validator.checks.noOrphanEvidenceReferences],
    ["No runtime_enabled=true", view.validator.checks.noRuntimeEnabledTrue],
    ["No productionReady=true", view.validator.checks.noProductionReadyTrue],
    ["Every edge endpoint exists", view.validator.checks.everyEdgeEndpointExists],
    ["Every node has provenance", view.validator.checks.everyNodeHasProvenance],
    ["Every edge has provenance", view.validator.checks.everyEdgeHasProvenance],
  ] as const;
  return (
    <section className="lipi-numeral-panel" aria-label="Node/Edge Validator">
      <header>
        <h3>Node/Edge Validator</h3>
        <Badge label="nodes" value={String(view.validator.graphSummary.totalNodes)} tone="verified" />
        <Badge label="edges" value={String(view.validator.graphSummary.totalEdges)} tone="verified" />
      </header>
      <div className="lipi-blocked-grid">
        {checks.map(([label, value]) => (
          <article key={label}>
            <strong>{label}</strong>
            <Badge label="pass" value={String(value)} tone={value ? "verified" : "blocked"} />
            <p>{value ? "Verified from current KBS graph and audit report." : "Blocked until the audit report is regenerated cleanly."}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RegistryDiffPanel({ view }: { view: ReturnType<typeof getLipiRegistryAuditabilityView> }) {
  const diff = view.registryDiff;
  const changedCriticalFields = diff.changedCriticalFields as string[];
  return (
    <section className="lipi-numeral-panel" aria-label="Registry Diff Viewer">
      <header>
        <h3>Registry Diff Viewer</h3>
        <Badge label="base" value={String(diff.baseRecordCount)} tone="neutral" />
        <Badge label="export" value={String(diff.exportRecordCount)} tone="verified" />
        <Badge label="critical drift" value={String(diff.changedCriticalFields.length)} tone={diff.changedCriticalFields.length === 0 ? "verified" : "blocked"} />
      </header>
      <div className="lipi-graph-summary">
        <RegistryStat label="Added" value={diff.addedRows.length} />
        <RegistryStat label="Removed" value={diff.removedRows.length} />
        <RegistryStat label="Critical Drift" value={diff.changedCriticalFields.length} />
        <RegistryStat label="Rows Exported" value={diff.exportRecordCount} />
      </div>
      <div className="lipi-kbs-card">
        <h4>Critical Field Policy</h4>
        {diff.criticalFieldPolicy.map((field) => (
          <div key={field}>
            <span>{field}</span>
            <strong>{changedCriticalFields.includes(field) ? "DRIFT" : "stable"}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function FederatedSourceRegistryPanel({ view }: { view: ReturnType<typeof getLipiEvidenceFederationView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Source Registry">
      <header>
        <h3>Source Registry</h3>
        <Badge label="sources" value={String(view.sourceRegistry.summary.sources)} tone="verified" />
        <Badge label="not ingested" value={String(view.sourceRegistry.summary.notIngested)} tone={view.sourceRegistry.summary.notIngested ? "blocked" : "verified"} />
        <Badge label="new claims" value={String(view.sourceRegistry.summary.createsNewScriptClaims)} tone={view.sourceRegistry.summary.createsNewScriptClaims ? "blocked" : "verified"} />
      </header>
      <div className="lipi-result-list small">
        {view.sourceRegistry.sources.map((source) => (
          <article className="lipi-result-row" key={source.id}>
            <div className="lipi-row-main static">
              <span>{source.localStatus === "LOCAL_INGESTED" ? "IN" : source.localStatus === "NOT_INGESTED" ? "NO" : "PART"}</span>
              <strong>{source.displayName}</strong>
              <em>{source.id}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="status" value={source.localStatus} tone={source.localStatus === "NOT_INGESTED" ? "blocked" : source.localStatus === "LOCAL_INGESTED" ? "verified" : "draft"} />
              <Badge label="claims" value={String(source.createsNewScriptClaims)} tone={source.createsNewScriptClaims ? "blocked" : "verified"} />
            </div>
            <div className="lipi-row-blocks">{source.notes}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidenceLineagePanel({ view }: { view: ReturnType<typeof getLipiEvidenceFederationView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Evidence Lineage Graph">
      <header>
        <h3>Evidence Lineage</h3>
        <Badge label="nodes" value={String(view.lineageGraph.summary.nodes)} tone="verified" />
        <Badge label="edges" value={String(view.lineageGraph.summary.edges)} tone="verified" />
        <Badge label="claim edges" value={String(view.lineageGraph.summary.claimCreatingEdges)} tone={view.lineageGraph.summary.claimCreatingEdges ? "blocked" : "verified"} />
      </header>
      <div className="lipi-kbs-columns">
        <div className="lipi-kbs-card">
          <h4>Node Types</h4>
          {Object.entries(view.lineageGraph.summary.byNodeType).map(([label, count]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        <div className="lipi-kbs-card">
          <h4>Edge Types</h4>
          {Object.entries(view.lineageGraph.summary.byEdgeType).map(([label, count]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="lipi-result-list small">
        {view.lineageGraph.edges.slice(0, 60).map((edge) => (
          <article className="lipi-result-row" key={edge.id}>
            <div className="lipi-row-main static">
              <span>-&gt;</span>
              <strong>{edge.type}</strong>
              <em>{edge.fields.createsNewScriptClaims === false ? "no claims" : "blocked"}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="from" value={edge.from.replace("phase6:", "")} tone="neutral" />
              <Badge label="to" value={edge.to.replace("phase6:", "")} tone="neutral" />
            </div>
            <div className="lipi-row-blocks">{edge.sourceRefs.join(", ")}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SourceConflictPanel({ view }: { view: ReturnType<typeof getLipiEvidenceFederationView> }) {
  const checks = Object.entries(view.conflictDetector.checks);
  return (
    <section className="lipi-numeral-panel" aria-label="Source Conflict Detector">
      <header>
        <h3>Source Conflicts</h3>
        <Badge label="conflicts" value={String(view.conflictDetector.summary.conflicts)} tone={view.conflictDetector.summary.conflicts ? "blocked" : "verified"} />
        <Badge label="blocked comparisons" value={String(view.conflictDetector.summary.blockedComparisons)} tone="blocked" />
        <Badge label="new claims" value={String(view.conflictDetector.summary.newScriptClaimsCreated)} tone={view.conflictDetector.summary.newScriptClaimsCreated ? "blocked" : "verified"} />
      </header>
      <div className="lipi-blocked-grid">
        {checks.map(([label, value]) => (
          <article key={label}>
            <strong>{label}</strong>
            <Badge label="pass" value={String(value)} tone={value ? "verified" : "blocked"} />
            <p>{value ? "Verified by the Phase 6 detector." : "Blocked until the source registry is regenerated cleanly."}</p>
          </article>
        ))}
      </div>
      <div className="lipi-result-list small">
        {view.conflictDetector.blockedComparisons.map((comparison) => (
          <article className="lipi-result-row" key={comparison.sourceId}>
            <div className="lipi-row-main static">
              <span>NO</span>
              <strong>{comparison.sourceId}</strong>
              <em>{comparison.status}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="compared" value={String(comparison.compared)} tone="blocked" />
            </div>
            <div className="lipi-row-blocks">{comparison.reason}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProvenanceChainPanel({ view }: { view: ReturnType<typeof getLipiEvidenceFederationView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Provenance Chain Explorer">
      <header>
        <h3>Provenance Chains</h3>
        <Badge label="source chains" value={String(view.provenanceChains.summary.sourceChains)} tone="verified" />
        <Badge label="script chains" value={String(view.provenanceChains.summary.scriptChains)} tone="verified" />
        <Badge label="orphans" value={String(view.provenanceChains.summary.orphanScriptChains)} tone={view.provenanceChains.summary.orphanScriptChains ? "blocked" : "verified"} />
      </header>
      <div className="lipi-result-list small">
        {view.provenanceChains.sourceChains.map((chain) => (
          <article className="lipi-result-row" key={chain.sourceId}>
            <div className="lipi-row-main static">
              <span>{chain.chain.length}</span>
              <strong>{chain.label}</strong>
              <em>{chain.localStatus}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="claims" value={String(chain.createsNewScriptClaims)} tone={chain.createsNewScriptClaims ? "blocked" : "verified"} />
            </div>
            <div className="lipi-row-blocks">{chain.chain.slice(0, 4).map((edge) => edge.type).join(", ") || "Registered with no local lineage edges yet."}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdapterContractsPanel({ view }: { view: ReturnType<typeof getLipiSourceIngestionContractsView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Source Adapter Contracts">
      <header>
        <h3>Adapter Contracts</h3>
        <Badge label="adapters" value={String(view.adapterContracts.summary.adapters)} tone="verified" />
        <Badge label="writes" value={String(view.adapterContracts.summary.writesRegistryAdapters)} tone={view.adapterContracts.summary.writesRegistryAdapters ? "blocked" : "verified"} />
        <Badge label="silent enrich" value={String(view.adapterContracts.summary.silentEnrichmentAdapters)} tone={view.adapterContracts.summary.silentEnrichmentAdapters ? "blocked" : "verified"} />
        <Badge label="PHKD" value={view.phkdVerdict} tone="blocked" />
      </header>
      <div className="lipi-result-list small">
        {view.adapterContracts.adapters.map((adapter) => (
          <article className="lipi-result-row" key={adapter.id}>
            <div className="lipi-row-main static">
              <span>{adapter.mode === "VALIDATE_ONLY" ? "VAL" : "NO"}</span>
              <strong>{adapter.displayName}</strong>
              <em>{adapter.sourceLocalStatus}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="write" value={String(adapter.writesRegistry)} tone={adapter.writesRegistry ? "blocked" : "verified"} />
              <Badge label="silent" value={String(adapter.silentEnrichmentAllowed)} tone={adapter.silentEnrichmentAllowed ? "blocked" : "verified"} />
              <Badge label="claims" value={String(adapter.createsNewScriptClaims)} tone={adapter.createsNewScriptClaims ? "blocked" : "verified"} />
            </div>
            <div className="lipi-row-blocks">
              {adapter.fields.map((field) => `${field.field}:${field.status}`).join(" / ")}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function IngestionPolicyPanel({ view }: { view: ReturnType<typeof getLipiSourceIngestionContractsView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Ingestion Policy">
      <header>
        <h3>Ingestion Policy</h3>
        <Badge label="mode" value={view.ingestionPolicy.adapterMode} tone="blocked" />
        <Badge label="production" value={String(view.productionReady)} tone="blocked" />
        <Badge label="runtime" value="0" tone="blocked" />
      </header>
      <div className="lipi-blocked-grid">
        {view.ingestionPolicy.forbiddenActions.map((action) => (
          <article key={action}>
            <strong>{action}</strong>
            <Badge label="status" value="BLOCKED" tone="blocked" />
            <p>Adapter contracts may validate and report only; this action cannot update a registry row.</p>
          </article>
        ))}
      </div>
      <div className="lipi-kbs-card">
        <h4>Field Transitions</h4>
        {view.ingestionPolicy.fieldTransitionPolicy.map((transition) => (
          <div key={`${transition.from}:${transition.to}`}>
            <span>
              {transition.from} to {transition.to}
            </span>
            <strong>{transition.registryWriteAllowed ? "WRITE" : "NO WRITE"}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceTrustMatrixPanel({ view }: { view: ReturnType<typeof getLipiSourceIngestionContractsView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Source Trust Matrix">
      <header>
        <h3>Trust Matrix</h3>
        <Badge label="sources" value={String(view.trustMatrix.summary.sources)} tone="verified" />
        <Badge label="blocked" value={String(view.trustMatrix.summary.blockedFieldGroups)} tone="blocked" />
        <Badge label="unknown" value={String(view.trustMatrix.summary.unknownFieldGroups)} tone="unknown" />
      </header>
      <div className="lipi-result-list small">
        {view.trustMatrix.rows.map((row) => (
          <article className="lipi-result-row" key={row.sourceId}>
            <div className="lipi-row-main static">
              <span>{row.sourceLocalStatus === "LOCAL_INGESTED" ? "IN" : row.sourceLocalStatus === "NOT_INGESTED" ? "NO" : "PART"}</span>
              <strong>{row.displayName}</strong>
              <em>{row.sourceId}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="write" value={String(row.writesRegistry)} tone={row.writesRegistry ? "blocked" : "verified"} />
              <Badge label="silent" value={String(row.silentEnrichmentAllowed)} tone={row.silentEnrichmentAllowed ? "blocked" : "verified"} />
              <Badge label="claims" value={String(row.createsNewScriptClaims)} tone={row.createsNewScriptClaims ? "blocked" : "verified"} />
            </div>
            <div className="lipi-row-blocks">
              {row.fieldGroups.map((group) => `${group.fieldGroup}:${group.status}`).join(" / ")}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ConflictRulesPanel({ view }: { view: ReturnType<typeof getLipiSourceIngestionContractsView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Conflict Resolution Rules">
      <header>
        <h3>Conflict Rules</h3>
        <Badge label="rules" value={String(view.conflictRules.summary.rules)} tone="verified" />
        <Badge label="auto apply" value={String(view.conflictRules.summary.autoApplyRules)} tone={view.conflictRules.summary.autoApplyRules ? "blocked" : "verified"} />
        <Badge label="mutations" value={String(view.conflictRules.summary.registryMutationRules)} tone={view.conflictRules.summary.registryMutationRules ? "blocked" : "verified"} />
      </header>
      <div className="lipi-blocked-grid">
        {view.conflictRules.rules.map((rule) => (
          <article key={rule.id}>
            <strong>{rule.title}</strong>
            <Badge label="field" value={rule.adapterFieldStatus} tone={toneForAdapterFieldStatus(rule.adapterFieldStatus)} />
            <Badge label="auto" value={String(rule.autoApply)} tone={rule.autoApply ? "blocked" : "verified"} />
            <p>{rule.action}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DryRunHarnessPanel({ view }: { view: ReturnType<typeof getLipiIngestionDryRunView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Dry-Run Ingestion Harness">
      <header>
        <h3>Dry-Run Harness</h3>
        <Badge label="mode" value={view.dryRunReport.dryRun.mode} tone="blocked" />
        <Badge label="writes" value={String(view.dryRunReport.dryRun.rowsWritten)} tone={view.dryRunReport.dryRun.rowsWritten ? "blocked" : "verified"} />
        <Badge label="enriched" value={String(view.dryRunReport.dryRun.enrichedRows)} tone={view.dryRunReport.dryRun.enrichedRows ? "blocked" : "verified"} />
        <Badge label="promotion" value={view.dryRunReport.dryRun.promotionStatus} tone="blocked" />
      </header>
      <div className="lipi-graph-summary">
        <RegistryStat label="Adapters Run" value={view.dryRunReport.dryRun.adaptersRun} />
        <RegistryStat label="Field Previews" value={view.dryRunReport.dryRun.fieldDiffPreviews} />
        <RegistryStat label="Proposed Changes" value={view.dryRunReport.dryRun.proposedFieldChanges} />
        <RegistryStat label="Blockers" value={view.dryRunReport.dryRun.blockers} />
      </div>
      <div className="lipi-result-list small">
        {view.dryRunReport.adapterRuns.map((run) => (
          <article className="lipi-result-row" key={run.id}>
            <div className="lipi-row-main static">
              <span>{run.mode === "DRY_RUN_ONLY" ? "DRY" : "NO"}</span>
              <strong>{run.sourceId}</strong>
              <em>{run.status}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="writes" value={String(run.rowsWritten)} tone={run.rowsWritten ? "blocked" : "verified"} />
              <Badge label="enriched" value={String(run.enrichedRows)} tone={run.enrichedRows ? "blocked" : "verified"} />
              <Badge label="runtime" value={String(run.runtimeEnablements)} tone={run.runtimeEnablements ? "blocked" : "verified"} />
            </div>
            <div className="lipi-row-blocks">
              {run.fieldPreviewCount} previews / {run.blockers} blockers / {run.promotionStatus}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FieldDiffPreviewPanel({ view }: { view: ReturnType<typeof getLipiIngestionDryRunView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Field Diff Preview">
      <header>
        <h3>Field Diff Preview</h3>
        <Badge label="previews" value={String(view.fieldDiffPreview.summary.previews)} tone="verified" />
        <Badge label="changes" value={String(view.fieldDiffPreview.summary.proposedFieldChanges)} tone={view.fieldDiffPreview.summary.proposedFieldChanges ? "blocked" : "verified"} />
        <Badge label="mutations" value={String(view.fieldDiffPreview.summary.registryMutations)} tone={view.fieldDiffPreview.summary.registryMutations ? "blocked" : "verified"} />
      </header>
      <div className="lipi-result-list small">
        {view.fieldDiffPreview.previews.map((preview) => (
          <article className="lipi-result-row" key={preview.id}>
            <div className="lipi-row-main static">
              <span>{preview.previewOnly ? "PV" : "NO"}</span>
              <strong>{preview.field}</strong>
              <em>{preview.sourceId}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="status" value={preview.adapterFieldStatus} tone={toneForAdapterFieldStatus(preview.adapterFieldStatus)} />
              <Badge label="write" value={String(preview.wouldMutateRegistry)} tone={preview.wouldMutateRegistry ? "blocked" : "verified"} />
              <Badge label="enrich" value={String(preview.wouldEnrichRow)} tone={preview.wouldEnrichRow ? "blocked" : "verified"} />
            </div>
            <div className="lipi-row-blocks">{preview.diffKind}: {preview.proposedRegistryValue}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function IngestionBlockersPanel({ view }: { view: ReturnType<typeof getLipiIngestionDryRunView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Ingestion Blockers">
      <header>
        <h3>Ingestion Blockers</h3>
        <Badge label="blockers" value={String(view.blockers.summary.blockers)} tone="blocked" />
        <Badge label="promotion" value={view.blockers.summary.promotionBlocked ? "BLOCKED" : "OPEN"} tone={view.blockers.summary.promotionBlocked ? "blocked" : "verified"} />
        <Badge label="conflict policy" value={view.blockers.conflictPromotionPolicy.rule} tone="blocked" />
      </header>
      <div className="lipi-blocked-grid">
        {view.blockers.blockers.map((blocker) => (
          <article key={blocker.id}>
            <strong>{blocker.field}</strong>
            <Badge label="status" value={blocker.status} tone={toneForAdapterFieldStatus(blocker.status)} />
            <Badge label="severity" value={blocker.severity} tone={blocker.severity === "HIGH" ? "blocked" : "draft"} />
            <p>{blocker.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Iso15924ReportPanel({ view }: { view: ReturnType<typeof getLipiIso15924IngestionView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="ISO 15924 Ingestion Report">
      <header>
        <h3>ISO 15924 Report</h3>
        <Badge label="mode" value={view.report.ingestion.mode} tone="blocked" />
        <Badge label="writes" value={String(view.report.ingestion.rowsWritten)} tone={view.report.ingestion.rowsWritten ? "blocked" : "verified"} />
        <Badge label="promotion" value={view.report.ingestion.promotionStatus} tone={view.report.ingestion.promotionStatus === "BLOCKED" ? "blocked" : "verified"} />
      </header>
      <div className="lipi-graph-summary">
        <RegistryStat label="Official ISO Rows" value={view.report.ingestion.officialRowsRead} />
        <RegistryStat label="Unicode Rows" value={view.report.ingestion.unicodeScriptRowsCompared} />
        <RegistryStat label="Verified" value={view.report.summary.verifiedRows} />
        <RegistryStat label="Blocked" value={view.report.summary.blockedRows} />
      </div>
      <div className="lipi-kbs-card">
        <h4>Official Source</h4>
        <div>
          <span>URL</span>
          <strong>{view.report.officialSource.url}</strong>
        </div>
        <div>
          <span>Local snapshot</span>
          <strong>{view.report.officialSource.localPath}</strong>
        </div>
        <div>
          <span>SHA-256</span>
          <strong>{view.report.officialSource.sha256.slice(0, 24)}</strong>
        </div>
      </div>
    </section>
  );
}

function Iso15924CrosswalkPanel({ view }: { view: ReturnType<typeof getLipiIso15924IngestionView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="ISO 15924 Script Code Crosswalk">
      <header>
        <h3>ISO 15924 Crosswalk</h3>
        <Badge label="rows" value={String(view.crosswalk.summary.unicodeScriptRowsCompared)} tone="verified" />
        <Badge label="verified" value={String(view.crosswalk.summary.verifiedRows)} tone="verified" />
        <Badge label="blocked" value={String(view.crosswalk.summary.blockedRows)} tone={view.crosswalk.summary.blockedRows ? "blocked" : "verified"} />
      </header>
      <div className="lipi-result-list small">
        {view.crosswalk.rows.slice(0, 96).map((row) => (
          <article className="lipi-result-row" key={row.id}>
            <div className="lipi-row-main static">
              <span>{row.officialIso15924}</span>
              <strong>{row.unicodeScriptValue}</strong>
              <em>{row.officialEnglishName}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="status" value={row.status} tone={toneForAdapterFieldStatus(row.status)} />
              <Badge label="numeric" value={row.officialNumericCode} tone={row.officialNumericCode === "UNKNOWN" ? "unknown" : "neutral"} />
              <Badge label="pva" value={row.officialPva} tone={row.pvaMatch ? "verified" : "blocked"} />
            </div>
            <div className="lipi-row-blocks">{row.blockers.length ? row.blockers.join(", ") : "Official ISO code and PVA match; no registry change proposed."}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Iso15924DiffPanel({ view }: { view: ReturnType<typeof getLipiIso15924IngestionView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="ISO 15924 Diff Preview">
      <header>
        <h3>ISO 15924 Diff</h3>
        <Badge label="diffs" value={String(view.diffPreview.summary.diffs)} tone="verified" />
        <Badge label="changes" value={String(view.diffPreview.summary.proposedFieldChanges)} tone={view.diffPreview.summary.proposedFieldChanges ? "blocked" : "verified"} />
        <Badge label="mutations" value={String(view.diffPreview.summary.registryMutations)} tone={view.diffPreview.summary.registryMutations ? "blocked" : "verified"} />
      </header>
      <div className="lipi-result-list small">
        {view.diffPreview.diffs.slice(0, 96).map((diff) => (
          <article className="lipi-result-row" key={diff.id}>
            <div className="lipi-row-main static">
              <span>{diff.previewOnly ? "PV" : "NO"}</span>
              <strong>{diff.unicodeScriptValue}</strong>
              <em>{diff.diffKind}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="status" value={diff.status} tone={toneForAdapterFieldStatus(diff.status)} />
              <Badge label="patches" value={String(diff.proposedRegistryPatch.length)} tone={diff.proposedRegistryPatch.length ? "blocked" : "verified"} />
              <Badge label="runtime" value={String(diff.wouldEnableRuntime)} tone={diff.wouldEnableRuntime ? "blocked" : "verified"} />
            </div>
            <div className="lipi-row-blocks">{diff.reason}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Iso15924BlockersPanel({ view }: { view: ReturnType<typeof getLipiIso15924IngestionView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="ISO 15924 Blockers">
      <header>
        <h3>ISO 15924 Blockers</h3>
        <Badge label="blockers" value={String(view.blockers.summary.blockers)} tone={view.blockers.summary.blockers ? "blocked" : "verified"} />
        <Badge label="conflicts" value={String(view.blockers.summary.conflictRows)} tone={view.blockers.summary.conflictRows ? "blocked" : "verified"} />
        <Badge label="policy" value={view.blockers.conflictPromotionPolicy.rule} tone="blocked" />
      </header>
      <div className="lipi-blocked-grid">
        {view.blockers.blockers.map((blocker) => (
          <article key={blocker.id}>
            <strong>{blocker.unicodeScriptValue}</strong>
            <Badge label="iso" value={blocker.officialIso15924} tone="neutral" />
            <Badge label="pva" value={blocker.officialPva} tone="blocked" />
            <p>{blocker.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CldrReportPanel({ view }: { view: ReturnType<typeof getLipiCldrIngestionView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="CLDR Ingestion Report">
      <header>
        <h3>CLDR Report</h3>
        <Badge label="mode" value={view.report.ingestion.mode} tone="blocked" />
        <Badge label="writes" value={String(view.report.ingestion.rowsWritten)} tone={view.report.ingestion.rowsWritten ? "blocked" : "verified"} />
        <Badge label="promotion" value={view.report.ingestion.promotionStatus} tone={view.report.ingestion.promotionStatus === "BLOCKED" ? "blocked" : "verified"} />
      </header>
      <div className="lipi-graph-summary">
        <RegistryStat label="CLDR Files" value={view.report.ingestion.cldrMainLocaleFiles} />
        <RegistryStat label="Locale Links" value={view.report.ingestion.explicitLocaleScriptLinks} />
        <RegistryStat label="Verified" value={view.report.summary.verifiedRows} />
        <RegistryStat label="Blockers" value={view.report.ingestion.blockers} />
      </div>
      <div className="lipi-kbs-card">
        <h4>Official Source</h4>
        <div>
          <span>URL</span>
          <strong>{view.report.officialSource.url}</strong>
        </div>
        <div>
          <span>Local snapshot</span>
          <strong>{view.report.officialSource.localPath}</strong>
        </div>
        <div>
          <span>SHA-256</span>
          <strong>{view.report.officialSource.sha256.slice(0, 24)}</strong>
        </div>
      </div>
    </section>
  );
}

function CldrCrosswalkPanel({ view }: { view: ReturnType<typeof getLipiCldrIngestionView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="CLDR Script Locale Crosswalk">
      <header>
        <h3>CLDR Crosswalk</h3>
        <Badge label="rows" value={String(view.crosswalk.summary.unicodeScriptRowsCompared)} tone="verified" />
        <Badge label="verified" value={String(view.crosswalk.summary.verifiedRows)} tone="verified" />
        <Badge label="unknown" value={String(view.crosswalk.summary.unknownRows)} tone="unknown" />
        <Badge label="unmatched" value={view.crosswalk.unmatchedCldrScripts.join(", ")} tone="blocked" />
      </header>
      <div className="lipi-result-list small">
        {view.crosswalk.rows.filter((row) => row.status === "VERIFIED").slice(0, 80).map((row) => (
          <article className="lipi-result-row" key={row.id}>
            <div className="lipi-row-main static">
              <span>{row.unicodeScriptAlias}</span>
              <strong>{row.unicodeScriptValue}</strong>
              <em>{row.explicitLocaleScriptLinks} explicit CLDR links</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="status" value={row.status} tone={toneForAdapterFieldStatus(row.status)} />
              <Badge label="usage" value={row.languageUsageClaim} tone="unknown" />
              <Badge label="font" value={row.fontClaim} tone="unknown" />
            </div>
            <div className="lipi-row-blocks">
              {row.localeLinks.slice(0, 5).map((link) => `${link.localeId} @ ${link.sourcePath}`).join(" / ")}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CldrDiffPanel({ view }: { view: ReturnType<typeof getLipiCldrIngestionView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="CLDR Diff Preview">
      <header>
        <h3>CLDR Diff</h3>
        <Badge label="diffs" value={String(view.diffPreview.summary.diffs)} tone="verified" />
        <Badge label="changes" value={String(view.diffPreview.summary.proposedFieldChanges)} tone={view.diffPreview.summary.proposedFieldChanges ? "blocked" : "verified"} />
        <Badge label="mutations" value={String(view.diffPreview.summary.registryMutations)} tone={view.diffPreview.summary.registryMutations ? "blocked" : "verified"} />
      </header>
      <div className="lipi-graph-summary">
        <RegistryStat label="Source-Backed" value={view.diffPreview.summary.sourceBackedMetadataPreviews} />
        <RegistryStat label="No Explicit Link" value={view.diffPreview.summary.noExplicitLinkPreviews} />
        <RegistryStat label="Preview Rows" value={view.diffPreview.summary.previewOnlyRows} />
        <RegistryStat label="Runtime Enables" value={view.diffPreview.summary.runtimeEnablements} />
      </div>
      <div className="lipi-result-list small">
        {view.diffPreview.diffs.slice(0, 96).map((diff) => (
          <article className="lipi-result-row" key={diff.id}>
            <div className="lipi-row-main static">
              <span>{diff.previewOnly ? "PV" : "NO"}</span>
              <strong>{diff.unicodeScriptValue}</strong>
              <em>{diff.diffKind}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="status" value={diff.status} tone={toneForAdapterFieldStatus(diff.status)} />
              <Badge label="patches" value={String(diff.proposedRegistryPatch.length)} tone={diff.proposedRegistryPatch.length ? "blocked" : "verified"} />
              <Badge label="runtime" value={String(diff.wouldEnableRuntime)} tone={diff.wouldEnableRuntime ? "blocked" : "verified"} />
            </div>
            <div className="lipi-row-blocks">{diff.reason}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CldrBlockersPanel({ view }: { view: ReturnType<typeof getLipiCldrIngestionView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="CLDR Blockers">
      <header>
        <h3>CLDR Blockers</h3>
        <Badge label="blockers" value={String(view.blockers.summary.blockers)} tone={view.blockers.summary.blockers ? "blocked" : "verified"} />
        <Badge label="ambiguous" value={String(view.blockers.summary.ambiguousScriptLocaleRelations)} tone="blocked" />
        <Badge label="policy" value={view.blockers.ambiguousRelationPolicy.rule} tone="blocked" />
      </header>
      <div className="lipi-blocked-grid">
        {view.blockers.blockers.map((blocker) => (
          <article key={blocker.id}>
            <strong>{blocker.cldrScript}</strong>
            <Badge label="status" value={blocker.status} tone="blocked" />
            <Badge label="links" value={String(blocker.localeLinks.length)} tone="neutral" />
            <p>{blocker.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function NumeralZeroPanel({ view }: { view: ReturnType<typeof getLipiNumeralZeroView> }) {
  const visibleRows = view.rows.slice(0, 36);
  return (
    <section className="lipi-numeral-panel" aria-label="Numeral and zero view">
      <header>
        <h3>Numeral Explorer</h3>
        <Badge label="zero known" value={String(view.summary.rowsWithKnownZeroGlyph)} tone={view.summary.rowsWithKnownZeroGlyph ? "verified" : "unknown"} />
        <Badge label="digit inventory" value={String(view.summary.rowsWithDigitInventory)} tone={view.summary.rowsWithDigitInventory ? "verified" : "unknown"} />
        <Badge label="unknown" value={String(view.summary.rowsStillUnknown)} tone="unknown" />
      </header>
      {visibleRows.length ? (
        <div className="lipi-result-list small">
          {visibleRows.map((row) => (
            <article className="lipi-result-row" key={row.id}>
              <div className="lipi-row-main static">
                <span>{row.zeroGlyph}</span>
                <strong>{row.displayName}</strong>
                <em>{row.zeroCodePoint}</em>
              </div>
              <div className="lipi-digits">
                {row.digits.map((digit) => (
                  <span key={`${row.id}:${digit.value}`}>
                    {digit.value}: {digit.glyph}
                  </span>
                ))}
              </div>
              <div className="lipi-row-blocks">{row.sourceRefs.join(", ")}</div>
            </article>
          ))}
        </div>
      ) : (
        <p className="lipi-empty-note">No UCD decimal digit inventory was found.</p>
      )}
    </section>
  );
}

function ZeroRegistryPanel({ view }: { view: ReturnType<typeof getLipiZeroRegistryView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Zero registry">
      <header>
        <h3>Zero Registry</h3>
        <Badge label="zero glyph scripts" value={String(view.summary.zeroGlyphScripts)} tone="verified" />
        <Badge label="missing" value={String(view.summary.missingZeroGlyphScripts.length)} tone={view.summary.missingZeroGlyphScripts.length ? "blocked" : "verified"} />
      </header>
      <div className="lipi-result-list small">
        {view.records.slice(0, 72).map((record) => (
          <article className="lipi-result-row" key={record.scriptValue}>
            <div className="lipi-row-main static">
              <span>{record.zeroGlyph}</span>
              <strong>{record.scriptValue.replace(/_/g, " ")}</strong>
              <em>{record.zeroCodePoint}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="evidence" value="verified" tone="verified" />
              <Badge label="source" value="UnicodeData" tone="neutral" />
            </div>
            <div className="lipi-row-blocks">{record.sourceRefs.join(", ")}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FamilyTreePanel({ view }: { view: ReturnType<typeof getLipiFamilyGraphView> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Family tree explorer">
      <header>
        <h3>Family Tree Explorer</h3>
        <Badge label="script nodes" value={String(view.summary.scriptNodes)} tone="verified" />
        <Badge label="block edges" value={String(view.summary.verifiedScriptBlockEdges)} tone="verified" />
        <Badge label="genealogy" value={String(view.summary.genealogicalFamilyEdges)} tone="unknown" />
      </header>
      <p className="lipi-empty-note">{view.summary.blockedReason}</p>
      <div className="lipi-result-list small">
        {view.scriptBlockEdges.slice(0, 72).map((edge) => (
          <article className="lipi-result-row" key={`${edge.from}:${edge.to}`}>
            <div className="lipi-row-main static">
              <span>-&gt;</span>
              <strong>{edge.from.replace("script:", "").replace(/_/g, " ")}</strong>
              <em>{edge.relation}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="evidence" value={edge.evidenceStatus} tone="verified" />
            </div>
            <div className="lipi-row-blocks">{edge.to.replace("block:", "")}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function UnicodeCrosswalkPanel({ view }: { view: ReturnType<typeof getLipiUnicodeCrosswalk> }) {
  return (
    <section className="lipi-numeral-panel" aria-label="Unicode crosswalk explorer">
      <header>
        <h3>Unicode Crosswalk Explorer</h3>
        <Badge label="rows" value={String(view.total)} tone="verified" />
        <Badge label="production" value="false" tone="blocked" />
      </header>
      <div className="lipi-result-list small">
        {view.rows.slice(0, 80).map((row) => (
          <article className="lipi-result-row" key={row.id}>
            <div className="lipi-row-main static">
              <span>{row.unicodeScriptAlias}</span>
              <strong>{row.displayName}</strong>
              <em>{row.iso15924}</em>
            </div>
            <div className="lipi-row-meta">
              <Badge label="ranges" value={String(row.unicodeRanges.length)} tone={row.unicodeRanges.length ? "verified" : "unknown"} />
              <Badge label="font" value={row.fontSupportStatus} tone="unknown" />
              <Badge label="translit" value={row.transliterationStatus} tone="unknown" />
            </div>
            <div className="lipi-row-blocks">{row.unicodeBlocks.length ? row.unicodeBlocks.slice(0, 3).map((block) => block.blockName).join(" / ") : "NO VERIFIED BLOCK"}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DetailBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="lipi-detail-block">
      <h4>{title}</h4>
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function RegistryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="lipi-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ label, value, tone }: LipiRegistryBadge) {
  return (
    <span className={`lipi-badge ${tone}`}>
      {label}: {value}
    </span>
  );
}

function toneForAdapterFieldStatus(status: string): LipiRegistryBadge["tone"] {
  if (status === "VERIFIED") return "verified";
  if (status === "BLOCKED" || status === "CONFLICT") return "blocked";
  if (status === "UNKNOWN") return "unknown";
  return "neutral";
}
