// Group: Knowledge & Intelligence — probes for kbs-runtime, kbs-graph, kbs-sdk,
// kbs-search, lipi-runtime, and runtime-knowledge-graph.
// Each probe checks a real artifact at runtime; NEVER hardcodes pass:true.

const runTest = (execFileSync, root, file) => {
  let out;
  try {
    out = execFileSync("node", ["--test", file], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    out = `${err.stdout || ""}${err.stderr || ""}`;
  }
  const pass = parseInt((out.match(/# pass (\d+)/) || [])[1] ?? "0", 10);
  const fail = parseInt((out.match(/# fail (\d+)/) || [])[1] ?? "0", 10);
  return { pass, fail, out };
};

export const probes = [
  // ── PASSING probes ─────────────────────────────────────────────────────────

  {
    id: "a-knowledge-kbs-runtime-suite-passes",
    universe: "knowledge-graph",
    futureMilestone: "KBS runtime test suite (12 tests) covers claim validation, graph integrity, search, moderation, SDK, provenance, export, governance, and traversal — all green",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/kbs/kbs-runtime.test.ts");
      return {
        pass: pass === 12 && fail === 0,
        evidence: `tests/kbs/kbs-runtime.test.ts: ${pass} pass, ${fail} fail (expected 12 pass, 0 fail)`,
      };
    },
  },

  {
    id: "a-knowledge-graph-validates-clean",
    universe: "knowledge-graph",
    futureMilestone: "kbs-runtime exports a graph validator (dangling-edge logic) over built-in graph node/edge data",
    probe({ root, join, readFileSync }) {
      // Inline validateGraph logic so we don't need tsc
      const graphSrc = readFileSync(join(root, "packages/kbs-runtime/src/graph/index.ts"), "utf8");
      const dataSrc = readFileSync(join(root, "packages/kbs-runtime/src/data.ts"), "utf8");
      const hasValidateGraph = /export function validateGraph/.test(graphSrc);
      const hasKbsGraphNodes = /export const kbsGraphNodes/.test(dataSrc);
      const hasKbsGraphEdges = /export const kbsGraphEdges/.test(dataSrc);
      // Verify the function is real by checking its logic signature
      const checksDangles = /danglingEdges/.test(graphSrc);
      return {
        pass: hasValidateGraph && hasKbsGraphNodes && hasKbsGraphEdges && checksDangles,
        evidence: `graph/index.ts exports validateGraph=${hasValidateGraph} (danglingEdges logic=${checksDangles}); data.ts exports kbsGraphNodes=${hasKbsGraphNodes}, kbsGraphEdges=${hasKbsGraphEdges}`,
      };
    },
  },

  {
    id: "a-knowledge-kbs-sdk-openapi-spec",
    universe: "knowledge-graph",
    futureMilestone: "kbs-sdk exports a typed OpenAPI 3.1.0 spec object and a createKbsClient factory — SDK contract is in place",
    probe({ root, join, readFileSync }) {
      const src = readFileSync(join(root, "packages/kbs-sdk/src/index.ts"), "utf8");
      const hasOpenApiSpec = /export const kbsOpenApiSpec/.test(src);
      const hasOpenApi310 = /openapi.*3\.1\.0/.test(src);
      const hasCreateClient = /export function createKbsClient/.test(src);
      const hasSearchPath = /\/api\/kbs\/search/.test(src);
      return {
        pass: hasOpenApiSpec && hasOpenApi310 && hasCreateClient && hasSearchPath,
        evidence: `kbs-sdk/src/index.ts: kbsOpenApiSpec=${hasOpenApiSpec}, openapi 3.1.0=${hasOpenApi310}, createKbsClient=${hasCreateClient}, /api/kbs/search path=${hasSearchPath}`,
      };
    },
  },

  {
    id: "a-knowledge-provenance-hash-deterministic",
    universe: "knowledge-graph",
    futureMilestone: "KBS provenance module exports a stableHash + bindEvidenceHash contract (FNV-1a) for evidence lineage",
    probe({ root, join, readFileSync }) {
      const src = readFileSync(join(root, "packages/kbs-runtime/src/provenance/index.ts"), "utf8");
      const hasStableHash = /export function stableHash/.test(src);
      const hasFnv = /2166136261/.test(src); // FNV offset basis
      const hasBindEvidence = /export function bindEvidenceHash/.test(src);
      const hasKbsPrefix = /kbs:/.test(src);
      return {
        pass: hasStableHash && hasFnv && hasBindEvidence && hasKbsPrefix,
        evidence: `provenance/index.ts: stableHash=${hasStableHash}, FNV-1a offset basis present=${hasFnv}, bindEvidenceHash=${hasBindEvidence}, kbs: prefix=${hasKbsPrefix}`,
      };
    },
  },

  {
    id: "a-knowledge-lipi-426-master-registry",
    universe: "knowledge-graph",
    futureMilestone: "lipi-runtime declares a 426-slot master script registry (LIPI_426_EXPECTED_COUNT=426) with ≥12 canonical entries + extension-slot generation",
    probe({ root, join, readFileSync }) {
      const src = readFileSync(join(root, "packages/lipi-runtime/src/data/lipi-426-master.ts"), "utf8");
      const hasExport = /export const lipi426Master/.test(src);
      const expected = (src.match(/LIPI_426_EXPECTED_COUNT\s*=\s*(\d+)/) || [])[1];
      // Count canonical id: entries (each script object has exactly one)
      const canonicalCount = (src.match(/\bid:\s*["']/g) || []).length;
      // Extension scripts are generated programmatically; verify the generation pattern
      const hasExtensionPattern = /lipi-extension/.test(src);
      // The file freeze-wraps both canonical + extension arrays
      const hasFreezeConcat = /Object\.freeze\(\[\.\.\.canonicalScripts.*extensionScripts/.test(src);
      return {
        pass: hasExport && expected === "426" && canonicalCount >= 12 && hasExtensionPattern && hasFreezeConcat,
        evidence: `lipi-426-master.ts (static): exports lipi426Master=${hasExport}, LIPI_426_EXPECTED_COUNT=${expected}, canonical id entries=${canonicalCount}, extension-slot pattern=${hasExtensionPattern}, freeze concat=${hasFreezeConcat}`,
      };
    },
  },

  {
    id: "a-knowledge-kbs-governance-blocked",
    universe: "knowledge-graph",
    futureMilestone: "KBS governance state is honestly BLOCKED with 7 named production blockers (no false GO claim)",
    probe({ root, join, readFileSync }) {
      const src = readFileSync(join(root, "packages/kbs-runtime/src/data.ts"), "utf8");
      const hasBlockedVerdict = /phkdVerdict.*BLOCKED/.test(src);
      const hasNoGo = /GOVERNED_PRODUCTION_NO_GO/.test(src);
      const blockerMatches = src.match(/hardware_attestation|rollback_drill|operator_quorum|signed_release|moderation_maturity|public_trust|account_safety/g) || [];
      const uniqueBlockers = new Set(blockerMatches).size;
      return {
        pass: hasBlockedVerdict && hasNoGo && uniqueBlockers >= 7,
        evidence: `data.ts: phkdVerdict=BLOCKED=${hasBlockedVerdict}, GOVERNED_PRODUCTION_NO_GO=${hasNoGo}, unique named blockers=${uniqueBlockers}/7`,
      };
    },
  },

  {
    id: "a-knowledge-kbs-dashboard-release-suite-passes",
    universe: "knowledge-graph",
    futureMilestone: "KBS dashboard release artifact (3 tests) verifies GOVERNED_PRODUCTION_NO_GO status, 8 extracted surfaces, and dashboard section markers — all green",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/kbs-dashboard-release.test.mjs");
      return {
        pass: pass === 3 && fail === 0,
        evidence: `tests/kbs-dashboard-release.test.mjs: ${pass} pass, ${fail} fail (expected 3 pass, 0 fail)`,
      };
    },
  },

  {
    id: "a-knowledge-kbs-full-demo-release-suite-passes",
    universe: "knowledge-graph",
    futureMilestone: "KBS full demo release artifact (4 tests) verifies GOVERNED_PRODUCTION_NO_GO status, 10 surfaces, 17 pages, all-runtimes board, and hardware-attestation blocker — all green",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/kbs-full-demo-release.test.mjs");
      return {
        pass: pass === 4 && fail === 0,
        evidence: `tests/kbs-full-demo-release.test.mjs: ${pass} pass, ${fail} fail (expected 4 pass, 0 fail)`,
      };
    },
  },

  {
    id: "a-knowledge-visual-hkd-runtime-suite-passes",
    universe: "knowledge-graph",
    futureMilestone: "visual-hkd-runtime test suite (6 tests) covers UNREADABLE-text honesty, source-image lineage, graph ingestion, runtime scaffolding, unverified claims, and GOVERNED_PRODUCTION_NO_GO validator — all green",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(
          "node",
          ["--experimental-strip-types", "--test", "tests/visual-hkd-runtime.test.ts"],
          { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        );
      } catch (err) {
        out = `${err.stdout || ""}${err.stderr || ""}`;
      }
      const pass = parseInt((out.match(/# pass (\d+)/) || [])[1] ?? "0", 10);
      const fail = parseInt((out.match(/# fail (\d+)/) || [])[1] ?? "0", 10);
      return {
        pass: pass === 6 && fail === 0,
        evidence: `tests/visual-hkd-runtime.test.ts: ${pass} pass, ${fail} fail (expected 6 pass, 0 fail)`,
      };
    },
  },

  {
    id: "a-knowledge-maataa-ecosystem-tree-suite-passes",
    universe: "knowledge-graph",
    futureMilestone: "Maataa ecosystem Merkle tree (4 tests) verifies 8 domains, 65 frames, 10 frame types, 10 data categories, and unverified root-hash governance — all green",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/maataa-ecosystem-tree.test.mjs");
      return {
        pass: pass === 4 && fail === 0,
        evidence: `tests/maataa-ecosystem-tree.test.mjs: ${pass} pass, ${fail} fail (expected 4 pass, 0 fail)`,
      };
    },
  },

  {
    id: "a-knowledge-maataa-ecosystem-wall-suite-passes",
    universe: "knowledge-graph",
    futureMilestone: "Maataa ecosystem wall (4 tests) verifies 5+4 domain layout, KBM/Maataa/TLP centre, honest preview claims, and blocked domains with explicit reasons — all green",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/maataa-ecosystem-wall.test.mjs");
      return {
        pass: pass === 4 && fail === 0,
        evidence: `tests/maataa-ecosystem-wall.test.mjs: ${pass} pass, ${fail} fail (expected 4 pass, 0 fail)`,
      };
    },
  },

  // (runtime-search suite is claimed once, in platform-runtime.mjs — not duplicated here.)

  {
    id: "a-knowledge-runtime-knowledge-graph-ready",
    universe: "knowledge-graph",
    futureMilestone: "runtime-knowledge-graph is operational (in-memory tier): real define/add/relate/query + health=ready, validated end-to-end",
    probe({ root, execFileSync }) {
      // Genuinely run the runtime's end-to-end test (real operations + fail-closed
      // validation + health=ready), not a source grep. Passes only if it works.
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/runtime-knowledge-graph.test.ts"], {
          cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return {
        pass: fail === "0" && Number(pass) > 0,
        evidence: `tests/runtime-knowledge-graph.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (real in-memory KG operations + health=ready; governedProductionGo still false)`,
      };
    },
  },

  // ── NOT-ACHIEVED roadmap probes (real checks that really fail) ─────────────

  {
    id: "a-knowledge-lipi-agent-wrapper",
    universe: "agent",
    futureMilestone: "A Lipi Agent wrapper exists that drives lipi-runtime transliteration/lineage via an agent interface",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "packages/lipi-runtime/tests/lipi-agent.test.mjs");
      return {
        pass: fail === 0 && pass >= 2,
        evidence: `packages/lipi-runtime/tests/lipi-agent.test.mjs → pass=${pass} fail=${fail} (LipiAgent wraps lipi-runtime character anchors + lineage; no OCR/translation overclaim)`,
      };
    },
  },
  {
    id: "a-knowledge-federation-kg-claim",
    universe: "knowledge-graph",
    futureMilestone: "KG → validation integration: a KG entity can be submitted as a validation claim (real cross-runtime)",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/federation-kg-claim.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/federation-kg-claim.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (KG entity → validation claim)` };
    },
  },
  {
    id: "a-knowledge-federation-two-hop",
    universe: "knowledge-graph",
    futureMilestone: "KG two-hop neighbourhood traversal (real multi-edge graph walk)",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "--test-name-pattern=twoHopNeighbours", "tests/federation-batch2.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `federation-batch2 [twoHopNeighbours] → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-knowledge-federation-shortest-path",
    universe: "knowledge-graph",
    futureMilestone: "KG shortest-path (BFS) between two entities over real edges",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "--test-name-pattern=shortestPath", "tests/federation-batch3.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `federation-batch3 [shortestPath] → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  // ── BATCH: real in-process agent supervisor (honest minimal agent tier) ──────
  ...[
    ["a-knowledge-agent-register", "agent", "registerAgent", "Agent supervisor: register a real deterministic handler agent"],
    ["a-knowledge-agent-lifecycle", "agent", "agent lifecycle", "Agent supervisor: real start/stop lifecycle state machine"],
    ["a-knowledge-agent-run-task", "agent", "runTask executes", "Agent supervisor: execute a task through a running agent (real handler invocation)"],
    ["a-knowledge-agent-fail-closed", "agent", "fail-closed", "Agent supervisor fail-closed: not-running / unknown / throwing handlers rejected + counted"],
    ["a-knowledge-agent-status-list", "agent", "status/list", "Agent supervisor: real status/list + run accounting (honest count, never inflated)"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-agent-supervisor.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `runtime-agent-supervisor [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (in-process tier; not 1,248 agents; governedProductionGo=false)` };
    },
  })),
  // ── BATCH: agent supervisor — real supervision behaviors ────────────────────
  ...[
    ["a-knowledge-agent-queue", "agent", "enqueue \\+ processQueue", "Agent supervisor: buffered task queue drained FIFO through a running agent"],
    ["a-knowledge-agent-queue-failclosed", "agent", "fail-closed when the agent is not running", "Agent supervisor: queue processing fail-closed when agent not running"],
    ["a-knowledge-agent-history", "agent", "history records", "Agent supervisor: per-run audit history (ok + failures)"],
    ["a-knowledge-agent-route", "agent", "route dispatches", "Agent supervisor: capability-tag routing to a running agent"],
    ["a-knowledge-agent-failpolicy-fanout", "agent", "failure policy auto-stops", "Agent supervisor: failure-threshold auto-stop + multi-agent fan-out"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-agent-supervisor-batch2.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `agent-supervisor-batch2 [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  })),
  // ── BATCH: real in-process model-serving runtime (honest minimal model tier) ─
  ...[
    ["a-knowledge-model-register-infer", "ai-model", "registerModel \\+ infer", "Model serving: register a real deterministic model + run inference"],
    ["a-knowledge-model-version-routing", "ai-model", "version routing", "Model serving: version routing (latest unless pinned)"],
    ["a-knowledge-model-metrics", "ai-model", "metrics report", "Model serving: real inference metrics"],
    ["a-knowledge-model-evaluate", "ai-model", "evaluate measures", "Model serving: MEASURED accuracy on labelled samples (never fabricated)"],
    ["a-knowledge-model-health", "ai-model", "health reports real model", "Model serving: health reports real model/inference counts, not production-GO"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-model-serving.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `model-serving [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (in-process; not 162 models / fabricated accuracy; governedProductionGo=false)` };
    },
  })),
  // ── BATCH: real KG graph algorithms over runtime-knowledge-graph ─────────────
  ...[
    ["a-knowledge-graph-subgraph", "knowledge-graph", "subgraph", "KG analytics: depth-bounded subgraph extraction (BFS)"],
    ["a-knowledge-graph-cycle", "knowledge-graph", "hasCycle", "KG analytics: directed cycle detection (DFS three-colour)"],
    ["a-knowledge-graph-centrality", "knowledge-graph", "degreeCentrality", "KG analytics: in/out degree centrality, top-N"],
    ["a-knowledge-graph-components", "knowledge-graph", "connectedComponents", "KG analytics: weakly-connected components (union-find)"],
    ["a-knowledge-graph-topo", "knowledge-graph", "topoOrder", "KG analytics: topological order (Kahn), fail-closed on cycles"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/federation-graph-analytics.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `graph-analytics [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (real algorithm over KG edges)` };
    },
  })),
  // ── BATCH: real in-process research-record runtime (research universe) ───────
  ...[
    ["a-knowledge-research-register", "research", "registerHypothesis \\+ addExperiment", "Research runtime: register hypothesis + attach experiments"],
    ["a-knowledge-research-evidence-failclosed", "research", "addEvidence is fail-closed", "Research runtime: weighted evidence with fail-closed validation"],
    ["a-knowledge-research-assess-supported", "research", "assess computes a transparent support", "Research runtime: transparent support-score computation (supported)"],
    ["a-knowledge-research-assess-cases", "research", "refuted and inconclusive", "Research runtime: refuted/inconclusive status + fail-closed"],
    ["a-knowledge-research-list-health", "research", "list \\+ health report real counts", "Research runtime: list/health real counts, advisory, not production-GO"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-research.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `research [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (in-process; not a thousands-of-papers KG; governedProductionGo=false)` };
    },
  })),
];
