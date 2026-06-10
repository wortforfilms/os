// Achievement probes for the data-schemas universe.
//
// PHKD: passes only against the REAL schema artifact at run time; fails closed.
// Resolves the HKD claim c-erd-13-tables (PARTIAL → ACHIEVED) when the platform
// ERD genuinely declares all 13 named entities with relations. This certifies a
// DESIGN artifact only — NOT a deployed/migrated database (see runtime-data
// README). It does not touch the still-BLOCKED multi-engine / IPFS claims.

const EXPECTED = [
  "User", "Profile", "Role", "Permission", "Project", "Task", "Milestone",
  "KnowledgeNode", "KnowledgeRelation", "KnowledgeSource", "Document", "Asset", "Event",
];

export const probes = [
  {
    id: "a-resolve-data-erd-13-tables",
    universe: "data-schemas",
    resolves: "c-erd-13-tables",
    futureMilestone:
      "ERD: users / profiles / roles / permissions / projects / tasks / milestones / knowledge_nodes / knowledge_relations / knowledge_sources / documents / assets / events",
    probe({ root, join, existsSync, readFileSync }) {
      const schemaPath = join(root, "packages/runtime-data/prisma/schema.prisma");
      if (!existsSync(schemaPath)) {
        return { pass: false, evidence: "packages/runtime-data/prisma/schema.prisma not found" };
      }
      const content = readFileSync(schemaPath, "utf8");
      const models = [...content.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
      const modelSet = new Set(models);
      const missing = EXPECTED.filter((e) => !modelSet.has(e));

      // Relations must reference real models, and named relations must be paired
      // (both @relation("X") sides present) — i.e. a coherent ERD, not stubs.
      const relTargets = [...content.matchAll(/^\s+\w+\s+(\w+)(?:\[\])?\??\s+@relation/gm)].map((m) => m[1]);
      const badTargets = relTargets.filter((t) => !modelSet.has(t));
      const names = [...content.matchAll(/@relation\("([^"]+)"/g)].map((m) => m[1]);
      const counts = names.reduce((a, n) => ((a[n] = (a[n] || 0) + 1), a), {});
      const unpaired = Object.entries(counts).filter(([, c]) => c !== 2).map(([n]) => n);
      const relationCount = (content.match(/@relation/g) || []).length;

      const hasDatasource = content.includes("datasource db");
      const hasGenerator = content.includes("generator client");

      const pass =
        missing.length === 0 &&
        badTargets.length === 0 &&
        unpaired.length === 0 &&
        relationCount > 0 &&
        hasDatasource &&
        hasGenerator;

      const why = pass
        ? `${models.length}/13 ERD models defined with ${relationCount} relation refs (all named relations paired; targets resolve). DESIGN artifact only — no migrations/engine/data; multi-engine & IPFS claims remain BLOCKED.`
        : `missing=[${missing.join(",")}] badRelationTargets=[${badTargets.join(",")}] unpairedRelations=[${unpaired.join(",")}] datasource=${hasDatasource} generator=${hasGenerator}`;

      return { pass, evidence: why };
    },
  },
];
