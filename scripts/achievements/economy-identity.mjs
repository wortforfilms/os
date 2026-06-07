// Group: Economy & Identity
//
// HONEST SCOPE: This group covers brahmini-chain, marketplace, financial,
// identity, sku, and asset-library universes. All six are currently
// vision-only. No blockchain, no marketplace, no identity runtime, no
// financial instruments, no SKU licensing, and no asset CDN exist in the
// repo. Every fabricated metric (12,874 nodes, 54.21M transactions,
// 3.842M blocks, 28.74K smart contracts, $12.48M GMV, 4.8M identities,
// 8.7 TB asset CDN, soulbound tokens, 1,248 marketplace agents) is
// BLOCKED in the HKD boards and is NOT probed here.
//
// What IS real and provable:
// 1. All six Economy & Identity HKD boards exist, parse as valid JSON,
//    and honestly declare status="vision" — no fabricated live metrics.
// 2. The milestones-vs-current.json records achieved=0 for this group,
//    which is the truthful count — no fabricated wins are claimed.
// 3. @maataa/lipi-runtime ships a 426-slot script master that defines
//    LIPI_426_EXPECTED_COUNT=426 (the design target) with 12 real canonical
//    script entries — the rest are BLOCKED extension stubs waiting for
//    evidence. This data lives inside the asset-library universe (Lipi
//    Glyphs component).
// 4. lipi-runtime typechecks cleanly with tsc --noEmit — the package is
//    internally consistent TypeScript.
// 5. lipi-runtime has 4 real SEEDED character anchors across brahmi,
//    kharosthi, and siddham scripts — honest small seed, not 15,000+ glyphs.

const ECONOMY_IDENTITY_HKD_FILES = [
  "brahmini-chain-universe.hkd",
  "marketplace-universe.hkd",
  "financial-universe.hkd",
  "identity-personhood-universe.hkd",
  "sku-universe.hkd",
  "asset-library-universe.hkd",
];

export const probes = [
  {
    id: "a-economy-hkd-boards-valid-vision",
    universe: "asset-library",
    futureMilestone:
      "All 6 Economy & Identity universe boards exist as valid JSON files with status=vision (honest declaration that no metrics are live)",
    probe({ root, join, existsSync, readFileSync }) {
      const hkdDir = join(root, "hkd");
      const errors = [];
      for (const f of ECONOMY_IDENTITY_HKD_FILES) {
        const path = join(hkdDir, f);
        if (!existsSync(path)) {
          errors.push(`missing: ${f}`);
          continue;
        }
        let d;
        try {
          d = JSON.parse(readFileSync(path, "utf8"));
        } catch (e) {
          errors.push(`parse error in ${f}: ${e.message}`);
          continue;
        }
        if (d.status !== "vision") {
          errors.push(`${f} has status="${d.status}" not "vision"`);
        }
        if (!d.universe) {
          errors.push(`${f} missing universe field`);
        }
      }
      const pass = errors.length === 0;
      return {
        pass,
        evidence: pass
          ? `All ${ECONOMY_IDENTITY_HKD_FILES.length} Economy & Identity HKD boards parse as valid JSON with status="vision"`
          : `Errors: ${errors.join("; ")}`,
      };
    },
  },

  {
    id: "a-economy-lipi-426-master-defined",
    universe: "asset-library",
    futureMilestone:
      "lipi-runtime defines LIPI_426_EXPECTED_COUNT=426 with ≥1 canonical script entry (asset-library / Lipi Glyphs component, design target encoded)",
    probe({ root, join, readFileSync }) {
      const src = readFileSync(
        join(root, "packages/lipi-runtime/src/data/lipi-426-master.ts"),
        "utf8"
      );
      const countMatch = src.match(/LIPI_426_EXPECTED_COUNT\s*=\s*(\d+)/);
      const count = countMatch ? parseInt(countMatch[1], 10) : 0;
      const hasExport = src.includes("export const lipi426Master");
      // Canonical entries: id strings that are not extension stubs
      const canonical = (src.match(/id:\s*"(?!lipi-extension)[^"]+"/g) || []).length;
      const pass = count === 426 && hasExport && canonical >= 1;
      return {
        pass,
        evidence: `LIPI_426_EXPECTED_COUNT=${count}, export lipi426Master=${hasExport}, canonical script entries=${canonical} (rest are BLOCKED extension stubs waiting for evidence)`,
      };
    },
  },

  {
    id: "a-economy-lipi-runtime-typechecks",
    universe: "asset-library",
    futureMilestone:
      "lipi-runtime (asset-library / Lipi Glyphs runtime) passes tsc --noEmit typecheck",
    probe({ root, execFileSync }) {
      try {
        execFileSync(
          "node_modules/.bin/tsc",
          ["-p", "packages/lipi-runtime/tsconfig.json", "--noEmit"],
          { cwd: root, encoding: "utf8" }
        );
        return {
          pass: true,
          evidence:
            "packages/lipi-runtime/tsconfig.json → tsc --noEmit exited 0 (no type errors)",
        };
      } catch (e) {
        const out = `${e.stdout || ""}${e.stderr || ""}`.trim().slice(0, 300);
        return { pass: false, evidence: `tsc failed: ${out}` };
      }
    },
  },

  {
    id: "a-economy-lipi-seeded-character-anchors",
    universe: "asset-library",
    futureMilestone:
      "lipi-runtime has ≥4 SEEDED character anchors across ≥2 real scripts (brahmi, kharosthi, siddham) — honest small seed, not 15,000+",
    probe({ root, join, readFileSync }) {
      const src = readFileSync(
        join(root, "packages/lipi-runtime/src/characters/token-anchors.ts"),
        "utf8"
      );
      const seeded = (src.match(/anchorStatus:\s*"SEEDED"/g) || []).length;
      const scripts = ["brahmi", "kharosthi", "siddham"];
      const presentScripts = scripts.filter((s) =>
        src.includes(`scriptId: "${s}"`)
      );
      const pass = seeded >= 4 && presentScripts.length >= 2;
      return {
        pass,
        evidence: `SEEDED anchors=${seeded} across scripts=[${presentScripts.join(", ")}] — honest seed count (15,000+ glyph asset library is NOT achieved)`,
      };
    },
  },
  {
    // HONEST counterpart to the fabricated c-lipi-glyphs-15k: a real Unicode-backed
    // glyph library (403 genuine assigned codepoints). This does NOT claim 15,000+
    // — that claim stays NOT_ACHIEVED. This milestone is the real, evidenced thing.
    id: "a-economy-lipi-glyph-library-real",
    universe: "asset-library",
    futureMilestone: "Real Unicode-backed Lipi glyph library: genuine assigned codepoints across Brahmi/Kharoshthi/Devanagari/Siddham (NOT the fabricated 15,000+ claim)",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/lipi-glyphs.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/lipi-glyphs.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (403 real Unicode glyphs; 15,000+ is fabricated and stays NOT_ACHIEVED)` };
    },
  },
];
