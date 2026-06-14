// Group: Knowledge & Intelligence — HKD capsule schema runtime.
//
// HONEST SCOPE: the HKD capsule contract absorbed from the operator vision-board
// mockups, with a real hkd:// URI parser and fail-closed validation. NOT a complete
// HKD certification; governedProductionGo=false. Each probe runs one named test in
// tests/runtime-hkd-schema.test.ts and only passes when that test is green at runtime.

export const probes = [
  ["a-hkd-schema-uri-parse",       "parseHkdUri parses",         "HKD schema: real hkd:// URI parser, fail-closed on bad scheme/empty path"],
  ["a-hkd-schema-uri-build",       "buildHkdUri round-trips",    "HKD schema: build hkd:// URIs, round-trips with the parser, fail-closed"],
  ["a-hkd-schema-validate-ok",     "validateHkd accepts",        "HKD schema: validate a well-formed capsule against the canonical contract"],
  ["a-hkd-schema-validate-closed", "validateHkd is fail-closed", "HKD schema: fail-closed validation (missing fields / bad status / bad uri / bad evidence)"],
  ["a-hkd-schema-entitled-status", "entitledStatus enforces",    "HKD schema: capsule rule — 'verified' requires source-proven evidence + zero blockers, else downgraded"],
  ["a-hkd-schema-contracts",       "contracts captured verbatim","HKD schema: verbatim contracts captured + health reports governedProductionGo=false"],
].map(([id, pattern, title]) => ({
  id,
  universe: "hkd-runtime",
  futureMilestone: title,
  probe({ root, execFileSync }) {
    let out;
    try {
      out = execFileSync(
        process.execPath,
        ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-hkd-schema.test.ts"],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
    const pass = (out.match(/# pass (\d+)/) || [])[1];
    const fail = (out.match(/# fail (\d+)/) || [])[1];
    return {
      pass: fail === "0" && Number(pass) > 0,
      evidence: `hkd-schema [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (absorbed from mockups; NOT a complete HKD certification; governedProductionGo=false)`,
    };
  },
}));
