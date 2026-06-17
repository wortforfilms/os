import { useMemo, useState } from "react";
import {
  getLipiEvidenceBadges,
  getLipiFamilyGraphView,
  getLipiKbsGraphView,
  getLipiNumeralZeroView,
  getLipiPhase3ScriptEnrichment,
  getLipiRegistryScript,
  getLipiRegistrySourceSummary,
  getLipiScriptKbsNeighborhood,
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
type ExplorerId = "numerals" | "zero" | "family" | "crosswalk" | "kbs";

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

      <div className="lipi-explorer-tabs" aria-label="Phase 3 explorers">
        {[
          ["numerals", "Numeral Explorer"],
          ["zero", "Zero Registry"],
          ["family", "Family Tree"],
          ["crosswalk", "Unicode Crosswalk"],
          ["kbs", "KBS Graph"],
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
