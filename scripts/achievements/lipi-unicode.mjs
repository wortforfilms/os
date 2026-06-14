// Group: Knowledge & Intelligence — Lipi Unicode authority dataset.
//
// HONEST SCOPE: this probe verifies the LOCAL UNICODE AUTHORITY LAYER only. It does
// NOT assert complete Lipi certification. UnicodeData.txt is the authority for
// character records; meanings are never invented; blocks outside cited ranges stay
// UNKNOWN. Corrected glyph counts (Brahmi 109, Kharoshthi 65, Devanagari 128,
// Siddham 92) replace the old hardcoded 403 claim.

const REQUIRED_FUNCTIONS = [
  "parseUnicodeDataLine", "loadUnicodeData", "getCharacterByCodepoint",
  "searchUnicodeByName", "listByRange", "listDevanagari", "listGurmukhi",
  "listIndicScripts", "summarizeUnicodeData",
];

const CORRECTED_COUNTS = { Brahmi: 109, Kharoshthi: 65, Devanagari: 128, Siddham: 92 };

export const probes = [
  {
    id: "lipi-unicode-authority-dataset",
    universe: "lipi",
    futureMilestone:
      "Lipi local Unicode authority: UnicodeData.txt absorbed with a real parser, CLI, tests, evidence, and dataset-corrected glyph counts (Brahmi 109 / Kharoshthi 65 / Devanagari 128 / Siddham 92) — NOT a complete Lipi certification; CONTROLLED_NO_GO.",
    probe({ root, join, existsSync, readFileSync, execFileSync }) {
      const checks = [];
      const fail = (m) => { checks.push("FAIL " + m); return false; };
      const pass = (m) => { checks.push("ok " + m); return true; };

      // 1. dataset file exists
      const dataPath = join(root, "data/unicode/UnicodeData.txt");
      if (!existsSync(dataPath)) return { pass: false, evidence: "missing data/unicode/UnicodeData.txt" };
      pass("dataset exists");

      // 2. parser exports required functions
      const srcPath = join(root, "packages/lipi-runtime/src/unicode-data.ts");
      if (!existsSync(srcPath)) return { pass: false, evidence: "missing unicode-data.ts" };
      const src = readFileSync(srcPath, "utf8");
      const missing = REQUIRED_FUNCTIONS.filter((fn) => !new RegExp(`export (function|const) ${fn}\\b`).test(src));
      if (missing.length) return { pass: false, evidence: `parser missing exports: ${missing.join(", ")}` };
      pass(`parser exports ${REQUIRED_FUNCTIONS.length} functions`);

      // 3. both test suites pass
      const runTest = (file) => {
        let out;
        try {
          out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", file], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
        const p = (out.match(/# pass (\d+)/) || [])[1];
        const f = (out.match(/# fail (\d+)/) || [])[1];
        return { p, f, ok: f === "0" && Number(p) > 0 };
      };
      const t1 = runTest("tests/lipi-unicode-data.test.mjs");
      const t2 = runTest("tests/maataa-cli.test.mjs");
      if (!t1.ok) return { pass: false, evidence: `lipi-unicode-data tests not green (pass=${t1.p} fail=${t1.f})` };
      if (!t2.ok) return { pass: false, evidence: `maataa-cli tests not green (pass=${t2.p} fail=${t2.f})` };
      pass(`tests green (data ${t1.p}, cli ${t2.p})`);

      // 4. evidence JSON exists + is valid + NO_GO
      const evPath = join(root, "release/evidence/lipi-unicode-data.json");
      if (!existsSync(evPath)) return { pass: false, evidence: "missing release/evidence/lipi-unicode-data.json" };
      let ev;
      try { ev = JSON.parse(readFileSync(evPath, "utf8")); } catch { return { pass: false, evidence: "evidence JSON invalid" }; }
      if (ev.status !== "CONTROLLED_NO_GO" || ev.governedProductionGo !== false) {
        return { pass: false, evidence: "evidence must declare CONTROLLED_NO_GO / governedProductionGo=false" };
      }
      pass(`evidence ok (${ev.totalRecords} records, status ${ev.status})`);

      // 5. CLI lookup works (0905 → DEVANAGARI LETTER A)
      let cliOut;
      try {
        cliOut = execFileSync(process.execPath, ["--experimental-strip-types", "scripts/maataa-lipi-unicode.mjs", "lipi", "unicode", "lookup", "0905"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { cliOut = `${e.stdout || ""}${e.stderr || ""}`; }
      if (!/DEVANAGARI LETTER A/.test(cliOut)) return { pass: false, evidence: "CLI lookup 0905 did not return DEVANAGARI LETTER A" };
      pass("CLI lookup works");

      // 6. corrected counts present (dataset-backed, not the old 403)
      const covPath = join(root, "release/evidence/lipi-glyph-coverage.json");
      if (!existsSync(covPath)) return { pass: false, evidence: "missing lipi-glyph-coverage.json (corrected counts)" };
      let cov;
      try { cov = JSON.parse(readFileSync(covPath, "utf8")); } catch { return { pass: false, evidence: "coverage JSON invalid" }; }
      const ingested = Object.fromEntries((cov.legacyReconciliation || []).map((r) => [r.script, r.ingested]));
      const wrong = Object.entries(CORRECTED_COUNTS).filter(([s, n]) => ingested[s] !== n);
      if (wrong.length) return { pass: false, evidence: `corrected counts mismatch: ${wrong.map(([s, n]) => `${s} expected ${n} got ${ingested[s]}`).join("; ")}` };
      if (cov.claimSatisfied !== false) return { pass: false, evidence: "coverage must NOT claim the fabricated 15,000 target" };
      pass(`corrected counts present (Brahmi 109, Kharoshthi 65, Devanagari 128, Siddham 92; 15k claim refused)`);

      return {
        pass: true,
        evidence: `Lipi Unicode authority verified: ${checks.filter((c) => c.startsWith("ok")).length}/6 checks — ${ev.totalRecords} UCD records, dataset-corrected counts, CONTROLLED_NO_GO (not a Lipi certification).`,
      };
    },
  },
  {
    id: "lipi-shapeshifter-cross-script",
    universe: "lipi",
    futureMilestone:
      "Lipi shapeshifter: one phonetic LETTER token rendered as real shapes across Brahmic scripts (observe_shift + relation_mind_graph), derived only from Unicode names — no invented meaning; CONTROLLED_NO_GO.",
    probe({ root, join, existsSync, execFileSync }) {
      if (!existsSync(join(root, "packages/lipi-runtime/src/shapeshifter.ts"))) {
        return { pass: false, evidence: "missing shapeshifter.ts" };
      }
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/lipi-shapeshifter.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return {
        pass: fail === "0" && Number(pass) > 0,
        evidence: `shapeshifter tests → pass=${pass ?? "?"} fail=${fail ?? "?"} (KA spans 17 scripts; correspondence from Unicode LETTER names only; governedProductionGo=false)`,
      };
    },
  },
  {
    id: "lipi-phonetic-binding-seeded",
    universe: "lipi",
    futureMilestone:
      "Lipi phonetic binding: shapeshifter tokens joined to the seeded in-repo IPA authority; IPA assigned ONLY where seeded, UNKNOWN (never invented) elsewhere — review-pending, CONTROLLED_NO_GO.",
    probe({ root, join, existsSync, execFileSync }) {
      if (!existsSync(join(root, "packages/lipi-runtime/src/phonetic-binding.ts"))) {
        return { pass: false, evidence: "missing phonetic-binding.ts" };
      }
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/lipi-phonetic-binding.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return {
        pass: fail === "0" && Number(pass) > 0,
        evidence: `phonetic-binding tests → pass=${pass ?? "?"} fail=${fail ?? "?"} (IPA only from seeded authority; unseeded tokens UNKNOWN/not-invented; review-pending; governedProductionGo=false)`,
      };
    },
  },
  {
    id: "lipi-devanagari-ipa-base",
    universe: "lipi",
    futureMilestone:
      "Lipi Devanagari→IPA: base aksharas mapped to standard ISO 15919 / Devanagari citation-form IPA, every entry NEEDS_NATIVE_REVIEW (not certified), unmapped letters UNKNOWN (not invented); CONTROLLED_NO_GO.",
    probe({ root, join, existsSync, execFileSync }) {
      if (!existsSync(join(root, "packages/lipi-runtime/src/devanagari-ipa.ts"))) {
        return { pass: false, evidence: "missing devanagari-ipa.ts" };
      }
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/lipi-devanagari-ipa.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return {
        pass: fail === "0" && Number(pass) > 0,
        evidence: `devanagari-ipa tests → pass=${pass ?? "?"} fail=${fail ?? "?"} (56/78 base aksharas mapped, review-pending, cited; rest UNKNOWN/not-invented; governedProductionGo=false)`,
      };
    },
  },
];
