// Achievement probe for the storage layer (runtime universe).
//
// PHKD: passes ONLY when the real integration tests for @maataa/runtime-storage
// are green at run time — exercising actual SQLite (node:sqlite), libSQL
// (@libsql/client, file mode), and IPFS-spec content addressing (multiformats,
// CID verified vs the public canonical vector). Fails closed if deps are missing
// for the platform or any backend regresses.
//
// Resolves c-storage-sqlite-libsql-ipfs (UNVERIFIED → ACHIEVED). Honest scope:
// 3 real backends, IPFS is a LOCAL content store (no public network). It does
// NOT resolve the separate 7-engine claim c-databases-7, which stays BLOCKED.

export const probes = [
  {
    id: "a-resolve-storage-sqlite-libsql-ipfs",
    universe: "runtime",
    resolves: "c-storage-sqlite-libsql-ipfs",
    futureMilestone: "Storage Layer: SQLite / libSQL / IPFS",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = "packages/runtime-storage/tests/storage.test.mjs";
      if (!existsSync(join(root, testFile))) {
        return { pass: false, evidence: `${testFile} not found` };
      }
      if (!existsSync(join(root, "packages/runtime-storage/node_modules/@libsql/client")) ||
          !existsSync(join(root, "packages/runtime-storage/node_modules/multiformats"))) {
        return { pass: false, evidence: "runtime-storage deps not installed (@libsql/client / multiformats) — fail closed for this platform" };
      }
      let out;
      try {
        out = execFileSync(process.execPath, ["--test", testFile], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      const ok = fail === "0" && Number(pass) > 0;
      return {
        pass: ok,
        evidence: ok
          ? `packages/runtime-storage tests → pass=${pass} fail=${fail}: real SQLite (node:sqlite) + libSQL (@libsql/client file mode) + IPFS content store (CID verified vs canonical vector). LOCAL only — no public IPFS network; 7-engine claim c-databases-7 stays BLOCKED; governedProductionGo=false.`
          : `storage tests not green → pass=${pass ?? "?"} fail=${fail ?? "?"}`,
      };
    },
  },
];
