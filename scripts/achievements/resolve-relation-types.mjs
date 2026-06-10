// Achievement probe for the knowledge-graph relation taxonomy.
//
// PHKD: passes ONLY when the real kbs-graph relation-types module declares all 13
// board-specified types AND its tests are green at run time (inverse consistency,
// fail-closed validation). Fails closed otherwise.
//
// Resolves c-13-relation-types (UNVERIFIED → ACHIEVED). Honest scope: a real,
// validated relation taxonomy in kbs-graph. It is distinct from the KBS evidence
// edge set (KbsEdgeType), which is unchanged.

const EXPECTED = [
  "IS_A", "PART_OF", "RELATED_TO", "CAUSED_BY", "DEPENDS_ON", "CREATED_BY",
  "USES", "MENTIONS", "LOCATED_IN", "OWNS", "INVESTS_IN", "TEACHES", "LEARNED_FROM",
];

export const probes = [
  {
    id: "a-resolve-kg-13-relation-types",
    universe: "knowledge-graph",
    resolves: "c-13-relation-types",
    futureMilestone:
      "13 Relation Types (IS_A / PART_OF / RELATED_TO / CAUSED_BY / DEPENDS_ON / CREATED_BY / USES / MENTIONS / LOCATED_IN / OWNS / INVESTS_IN / TEACHES / LEARNED_FROM)",
    probe({ root, join, existsSync, readFileSync, execFileSync }) {
      const mod = "packages/kbs-graph/src/relation-types.ts";
      const testFile = "tests/kg-relation-types.test.ts";
      if (!existsSync(join(root, mod))) {
        return { pass: false, evidence: `${mod} not found` };
      }
      // 1) Static check: all 13 named types are declared in the module.
      const src = readFileSync(join(root, mod), "utf8");
      const missing = EXPECTED.filter((t) => !new RegExp(`"${t}"`).test(src));
      if (missing.length) {
        return { pass: false, evidence: `relation types missing from module: [${missing.join(", ")}]` };
      }
      // 2) Behavioural check: the real tests pass (inverse consistency, validation).
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", testFile], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      const ok = fail === "0" && Number(pass) > 0;
      return {
        pass: ok,
        evidence: ok
          ? `kbs-graph/relation-types declares all 13 types; tests/kg-relation-types → pass=${pass} fail=${fail} (inverse consistency + fail-closed validation). Distinct from KBS evidence edges (KbsEdgeType unchanged).`
          : `relation-types tests not green → pass=${pass ?? "?"} fail=${fail ?? "?"}`,
      };
    },
  },
];
