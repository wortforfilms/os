// Group: Civilization & Domains — probes for genuine, runtime-checkable data integrity.
//
// HONESTY NOTE: This group's vision boards (civilization graphs, consciousness
// evolution metrics, 9.76M+ communities, 250+ schemas, health dashboards with
// live numbers) are fabricated / aspirational. We claim NONE of those.
//
// What IS genuinely provable:
//   1. Group-universe HKD board files exist and parse as valid JSON conforming
//      to VisualHKD shape (id, universe, claims[]).
//   2. Every group HKD board declares $schema pointing to the VisualHKD type.
//   3. Ecosystem data JSON files parse as valid JSON with a schema field.
//   4. lipi-runtime/prisma/schema.prisma defines real DB models (data-schemas
//      universe milestone: ERD is real but narrow — 3 lipi-domain tables, NOT
//      the board's aspirational 13-table ERD).

const GROUP_UNIVERSES = new Set([
  "civilization",
  "ecosystem",
  "health",
  "mission",
  "spatial",
  "time-evolution",
  "legacy",
  "data-schemas",
  "expanded-maataa-universe-collection",
]);

const HKD_SCHEMA_REF = "../packages/visual-hkd-runtime/src/types.ts#VisualHKD";

export const probes = [
  {
    id: "a-civ-group-hkd-boards-valid-json",
    universe: "data-schemas",
    futureMilestone:
      "All Civilization & Domains universe HKD board files are valid JSON and conform to VisualHKD shape (id, universe, claims[])",
    probe({ root, join, existsSync, readFileSync, readdirSync }) {
      const hkdDir = join(root, "hkd");
      const files = readdirSync(hkdDir).filter((f) => f.endsWith(".hkd") && !f.startsWith("._"));
      const valid = [];
      const invalid = [];

      for (const fn of files) {
        let d;
        try {
          d = JSON.parse(readFileSync(join(hkdDir, fn), "utf8"));
        } catch (e) {
          invalid.push(`${fn}: JSON parse error`);
          continue;
        }
        if (!GROUP_UNIVERSES.has(d.universe)) continue;

        const hasId = typeof d.id === "string" && d.id.length > 0;
        const hasUniverse = typeof d.universe === "string" && d.universe.length > 0;
        const hasClaims = Array.isArray(d.claims);

        if (hasId && hasUniverse && hasClaims) {
          valid.push(`${fn}(universe=${d.universe},claims=${d.claims.length})`);
        } else {
          invalid.push(
            `${fn}: missing id=${!hasId} universe=${!hasUniverse} claims=${!hasClaims}`
          );
        }
      }

      const pass = valid.length >= 9 && invalid.length === 0;
      return {
        pass,
        evidence: `${valid.length} valid group HKD boards; ${invalid.length} invalid. Boards: ${valid.join(", ")}`,
      };
    },
  },

  {
    id: "a-civ-group-hkd-schema-declared",
    universe: "data-schemas",
    futureMilestone:
      "Every Civilization & Domains HKD board declares $schema pointing to VisualHKD type definition",
    probe({ root, join, existsSync, readFileSync, readdirSync }) {
      const hkdDir = join(root, "hkd");
      const files = readdirSync(hkdDir).filter((f) => f.endsWith(".hkd"));
      const withSchema = [];
      const withoutSchema = [];

      for (const fn of files) {
        let d;
        try {
          d = JSON.parse(readFileSync(join(hkdDir, fn), "utf8"));
        } catch {
          continue;
        }
        if (!GROUP_UNIVERSES.has(d.universe)) continue;

        if (d["$schema"] === HKD_SCHEMA_REF) {
          withSchema.push(fn);
        } else {
          withoutSchema.push(`${fn}($schema=${d["$schema"] ?? "absent"})`);
        }
      }

      const pass = withSchema.length >= 9 && withoutSchema.length === 0;
      return {
        pass,
        evidence: `${withSchema.length} boards with correct $schema; ${withoutSchema.length} missing/wrong. Missing: [${withoutSchema.join(", ")}]`,
      };
    },
  },

  {
    id: "a-civ-ecosystem-data-files-valid",
    universe: "ecosystem",
    futureMilestone:
      "Ecosystem data files (maataa-ecosystem-wall.json, maataa-ecosystem-merkle-tree.json) are valid JSON with schema field",
    probe({ root, join, existsSync, readFileSync }) {
      const targets = [
        { path: "data/maataa-ecosystem-wall.json", expectedSchemaPrefix: "maataa.ecosystem.wall" },
        { path: "data/maataa-ecosystem-merkle-tree.json", expectedSchemaPrefix: "maataa.ecosystem.merkle-tree" },
      ];

      const results = [];
      for (const { path, expectedSchemaPrefix } of targets) {
        const fullPath = join(root, path);
        if (!existsSync(fullPath)) {
          results.push(`${path}: MISSING`);
          continue;
        }
        let d;
        try {
          d = JSON.parse(readFileSync(fullPath, "utf8"));
        } catch (e) {
          results.push(`${path}: JSON parse error`);
          continue;
        }
        const schema = d.schema ?? d["$schema"] ?? "";
        if (typeof schema === "string" && schema.startsWith(expectedSchemaPrefix)) {
          results.push(`${path}: OK (schema=${schema})`);
        } else {
          results.push(`${path}: schema field absent or wrong (got: ${schema})`);
        }
      }

      const pass = results.every((r) => r.includes(": OK"));
      return {
        pass,
        evidence: results.join(" | "),
      };
    },
  },

  {
    id: "a-civ-data-schemas-lipi-prisma-models",
    universe: "data-schemas",
    futureMilestone:
      "lipi-runtime ships a real Prisma schema with DB model definitions (data-schemas universe: ERD is real but scope-limited to lipi domain, NOT the board's full 13-table ERD)",
    probe({ root, join, existsSync, readFileSync }) {
      const schemaPath = join(root, "packages/lipi-runtime/prisma/schema.prisma");
      if (!existsSync(schemaPath)) {
        return { pass: false, evidence: "lipi-runtime/prisma/schema.prisma not found" };
      }
      const content = readFileSync(schemaPath, "utf8");
      const models = content
        .split("\n")
        .filter((l) => l.startsWith("model "))
        .map((l) => l.split(/\s+/)[1])
        .filter(Boolean);

      const hasDatasource = content.includes("datasource db");
      const hasGenerator = content.includes("generator client");
      const pass = models.length >= 3 && hasDatasource && hasGenerator;
      return {
        pass,
        evidence: `${models.length} Prisma models: [${models.join(", ")}]; datasource=${hasDatasource}; generator=${hasGenerator}. Honest scope: lipi-domain only, not the board's 13-table aspirational ERD.`,
      };
    },
  },
  {
    // Resolved by REAL feature work: runtime-mission is now an operational advisory
    // runtime (declare/observe/assess/propose), proven by tests/runtime-mission.test.ts.
    id: "a-civ-runtime-mission-operational",
    universe: "mission",
    futureMilestone: "runtime-mission is operational (in-memory advisory tier): real declare/assess/propose drift detection, never enforces",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/runtime-mission.test.ts"], {
          cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return {
        pass: fail === "0" && Number(pass) > 0,
        evidence: `tests/runtime-mission.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (real drift assessment; advisory-only, governedProductionGo=false)`,
      };
    },
  },
  // ── BATCH: real in-process versioning runtime (time-evolution universe) ──────
  ...[
    ["a-civ-versioning-snapshot", "time-evolution", "snapshot appends", "Versioning: append-only snapshots with content hashes"],
    ["a-civ-versioning-history", "time-evolution", "history lists", "Versioning: full version history (fail-closed on unknown key)"],
    ["a-civ-versioning-get", "time-evolution", "get returns latest", "Versioning: get value at latest or pinned version"],
    ["a-civ-versioning-diff", "time-evolution", "diff computes real", "Versioning: real structural diff (added/removed/changed) between versions"],
    ["a-civ-versioning-rollback", "time-evolution", "rollback restores", "Versioning: non-destructive rollback (recorded as a new version)"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-versioning.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `versioning [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (in-process; not the board's v1→v5 marketing; governedProductionGo=false)` };
    },
  })),
  // ── BATCH: real in-process spatial index (spatial universe) ──────────────────
  // HONEST SCOPE: exact brute-force 2-D point index. NOT a distributed geo system,
  // NOT the board's planetary "civilization graph". Real geometry, real fail-closed.
  ...[
    ["a-civ-spatial-insert", "spatial", "insert stores points", "Spatial: insert/upsert points, fail-closed on non-finite coords"],
    ["a-civ-spatial-remove", "spatial", "remove deletes", "Spatial: remove points, fail-closed on unknown id"],
    ["a-civ-spatial-range", "spatial", "rangeQuery returns points", "Spatial: exact axis-aligned bbox range query"],
    ["a-civ-spatial-nearest", "spatial", "nearest returns the closest", "Spatial: nearest-point by real Euclidean distance, fail-closed when empty"],
    ["a-civ-spatial-knn", "spatial", "knn returns k closest", "Spatial: k-nearest-neighbours sorted by distance"],
    ["a-civ-spatial-radius-bounds", "spatial", "withinRadius and bounds", "Spatial: within-radius query and bounding-box of all points"],
    ["a-civ-spatial-health", "spatial", "health reports real counts", "Spatial: health exposes real point count, not production-GO"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-spatial.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `spatial [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (in-process exact index; NOT a distributed geo system; governedProductionGo=false)` };
    },
  })),
];
