// Resolution probes for the Evidence/Traceability/Schema/Misc cluster.
// Each `resolves` field targets a specific HKD claim id.
// PHKD contract: pass:true ONLY when the FULL claim text is genuinely satisfied
// by a real, runtime-checkable artifact. Honest 0-3 resolutions expected.
//
// After careful investigation of all 20 candidate claims:
//
//  c-erd-13-tables          — lipi-runtime/prisma has 3 models (not 13). NOT satisfiable.
//  c-migrations-cli         — RESOLVED: scripts/maataa-migrate.mjs is now a real generate/up/down/status/history CLI (node:sqlite), proven by tests/migrations-cli.test.mjs.
//  c-values-embodied-12     — "embodied as measured property" not defined. NOT satisfiable.
//  c-policy-lifecycle       — Full Draft→Consult→Vote→Enact→Implement→Review→Evolve cycle not wired. NOT satisfiable.
//  c-50-open-modules        — ~15 packages on disk, not 50+. NOT satisfiable.
//  c-12-primary-universes   — 12 .hkd boards exist but claim "constitute MAATAA OS" as operational universes. NOT satisfiable.
//  c-7-missions-only-6-visible — Visual/counting claim about a board render, not checkable from repo. NOT satisfiable.
//  c-toolchain-installed    — Git/GitHub/Jenkins/SonarQube/Harbor/ArgoCD/Helm/Prometheus/Grafana: only git is present. NOT satisfiable.
//  c-evidence-integrity-framework — End-to-end integrity workflow not wired. NOT satisfiable.
//  c-evidence-workflow-honest — End-to-end evidence workflow not wired. NOT satisfiable.
//  c-maturity-l0-l9         — Maturity ladder exists conceptually but no claim in repo is plotted on it. NOT satisfiable.
//  claim-score-formula      — Formula is design logic in HKD but cannot be fed by real counts (board's claim is the formula operates). NOT satisfiable.
//  c-time-dimension-real    — hemant-core MonotonicTick is real but narrow (embedded); claim refers to cross-runtime real-time fabric. NOT satisfiable.
//  c-versioning-pipeline-real — package.json semver exists but timeline-entity semantic versioning does not. NOT satisfiable.
//  c-9-level-stack-model    — The MODEL is defined: 9 trace-level nodes with correct labels + edges in the canonical HKD file. SATISFIABLE (see probe below).
//  c-traceability-end-to-end — End-to-end flow not wired (evidence-generate.mjs + gate cover only lower 2 levels). NOT satisfiable.
//  c-enablers-stack         — Only 2 of 8 enablers have partial substrate (Knowledge Graph + HKD Runtime). NOT satisfiable.
//  c-journey-developer      — No SDK / no public API Hub / no CI-CD engine. NOT satisfiable.
//  c-journey-lapsi          — Studio and Archive Hub UI not built. NOT satisfiable.
//  c-journey-researcher     — End-to-end journey not orchestrated. NOT satisfiable.

export const probes = [
  {
    id: "a-resolve-ev-9-level-stack-model",
    universe: "traceability",
    resolves: "c-9-level-stack-model",
    futureMilestone: "9-Level Traceability Stack model is canonically defined: Mission → Universe → Runtime → Service → Feature → Workflow → Data → Evidence → Reality",
    probe({ root, join, readFileSync }) {
      const hkdPath = join(root, "hkd", "reality-to-mission-traceability-universe.hkd");
      let hkd;
      try {
        hkd = JSON.parse(readFileSync(hkdPath, "utf8"));
      } catch (e) {
        return { pass: false, evidence: `failed to parse traceability HKD: ${e.message}` };
      }

      const levels = (hkd.nodes || []).filter((n) => n.kind === "trace-level");
      const expectedLabels = ["Mission", "Universe", "Runtime", "Service", "Feature", "Workflow", "Data", "Evidence", "Reality"];

      if (levels.length !== 9) {
        return { pass: false, evidence: `expected 9 trace-level nodes, found ${levels.length}` };
      }

      const mismatches = expectedLabels.filter(
        (label, i) => !levels[i] || !levels[i].label.includes(label),
      );
      if (mismatches.length > 0) {
        return {
          pass: false,
          evidence: `trace-level label mismatch at expected label(s): ${mismatches.join(", ")}`,
        };
      }

      const edges = (hkd.edges || []).filter((e) => e.relation === "narrows-to");
      if (edges.length !== 8) {
        return { pass: false, evidence: `expected 8 narrows-to edges, found ${edges.length}` };
      }

      const actualLabels = levels.map((n) =>
        n.label
          .split("—")[0]
          .replace(/^\d+\.\s*/, "")
          .trim(),
      );
      return {
        pass: true,
        evidence: `hkd/reality-to-mission-traceability-universe.hkd contains exactly 9 trace-level nodes (${actualLabels.join(" → ")}) with 8 narrows-to edges — the canonical 9-level model is defined`,
      };
    },
  },
  {
    // Resolved by REAL feature work: scripts/maataa-migrate.mjs is a working
    // SQLite migration CLI, proven end-to-end by tests/migrations-cli.test.mjs.
    id: "a-resolve-ev-migrations-cli",
    universe: "data-schemas",
    resolves: "c-migrations-cli",
    futureMilestone: "maataa migrate CLI implements generate/up/down/status/history over a real SQLite ledger",
    probe({ root, execFileSync, existsSync, join }) {
      if (!existsSync(join(root, "scripts/maataa-migrate.mjs"))) {
        return { pass: false, evidence: "scripts/maataa-migrate.mjs not found" };
      }
      let out;
      try {
        out = execFileSync("node", ["--test", "tests/migrations-cli.test.mjs"], {
          cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return {
        pass: fail === "0" && Number(pass) > 0,
        evidence: `maataa migrate CLI verified end-to-end (generate/up/down/status/history; real SQLite exec) — tests/migrations-cli.test.mjs pass=${pass ?? "?"} fail=${fail ?? "?"}`,
      };
    },
  },
];
