// Resolution probes for the Knowledge/HKD cluster.
// Each probe checks whether the FULL claim text is genuinely satisfied by real,
// checkable evidence. A probe returning pass:false leaves the claim IN_PROGRESS.
// A probe returning pass:true (with resolves set) upgrades it to ACHIEVED.
//
// After direct investigation of:
//   packages/visual-hkd-runtime/src/types.ts + status-validator.ts
//   packages/kbs-runtime/src/{types,data,graph,search,claims,provenance}.ts
//   packages/runtime-knowledge-graph/src/index.ts
//   packages/kbs-sdk/src/index.ts
//   tests/kbs/kbs-runtime.test.ts
// all 17 claims in this cluster are found to be only partially implemented or
// aspirational. None qualify for ACHIEVED. See per-probe evidence strings.

export const probes = [
  {
    id: "a-resolve-kh-research-agent-real",
    universe: "hkd-runtime",
    resolves: "c-research-agent-real",
    futureMilestone: "Research Agent that autonomously discovers, analyzes, and validates knowledge",
    probe({ root, join, existsSync }) {
      // Claim: "Research Agent — discovers/analyzes/validates knowledge"
      // No autonomous Research Agent wrapper exists. kbs-runtime provides
      // research-adjacent primitives (claims, review, moderation, provenance)
      // but no agent class/entry-point that orchestrates them.
      const agentPaths = [
        "packages/kbs-runtime/src/agent",
        "packages/kbs-runtime/src/research-agent.ts",
        "packages/research-agent/src/index.ts",
      ];
      const found = agentPaths.some((p) => existsSync(join(root, p)));
      return {
        pass: false,
        evidence: `No research agent wrapper found; checked ${agentPaths.join(", ")}; existsSync=${found}`,
      };
    },
  },

  {
    id: "a-resolve-kh-ai-capabilities-partial",
    universe: "ai-model",
    resolves: "c-ai-capabilities-partial",
    futureMilestone: "AI Capabilities: Understand/Reason/Infer/Generate/Create/Perceive/Interpret/Plan/Decide/Remember/Learn/Act/Automate/Collaborate",
    probe({ root, join, existsSync }) {
      // Claim requires Generate/Create, Plan/Decide, Remember/Learn, Act/Automate,
      // Collaborate runtimes. kbs-runtime/src/search covers Understand substrate;
      // visual-hkd-runtime covers Perceive. The remaining 5+ categories have no
      // implementation packages.
      const requiredPaths = [
        "packages/runtime-generate",
        "packages/runtime-plan",
        "packages/runtime-collaborate",
      ];
      const missing = requiredPaths.filter((p) => !existsSync(join(root, p)));
      return {
        pass: false,
        evidence: `Claim requires 8 distinct AI capability runtimes; ${missing.length} of ${requiredPaths.length} checked dirs missing (${missing.join(", ")}). Only Understand+Perceive substrates exist.`,
      };
    },
  },

  {
    id: "a-resolve-kh-knowledge-graph-dashboard-real",
    universe: "dashboard",
    resolves: "c-knowledge-graph-dashboard-real",
    futureMilestone: "Knowledge Graph Dashboard renders the live knowledge graph",
    probe({ root, join, existsSync }) {
      // Claim: dashboard "renders the live knowledge graph".
      // kbs-graph + kbs-runtime/src/graph exist; no dashboard package or wiring.
      const dashboardPaths = [
        "packages/dashboard-knowledge-graph",
        "packages/kbs-dashboard/src/knowledge-graph.ts",
        "apps/dashboard/src/knowledge-graph",
      ];
      const found = dashboardPaths.some((p) => existsSync(join(root, p)));
      return {
        pass: false,
        evidence: `No knowledge-graph dashboard package or wiring found; checked ${dashboardPaths.join(", ")}; anyFound=${found}`,
      };
    },
  },

  {
    id: "a-resolve-kh-hkd-enabler",
    universe: "ecosystem",
    resolves: "c-hkd-enabler",
    futureMilestone: "HKD is the universal cross-ecosystem knowledge format",
    probe({ root, join, existsSync }) {
      // Claim: "HKD … universal knowledge format powering the ecosystem".
      // VisualHKD type exists (visual-hkd-runtime/src/types.ts) but is scoped to
      // vision-board extraction only. No cross-ecosystem wiring present.
      const typesFile = join(root, "packages/visual-hkd-runtime/src/types.ts");
      const ecosystemWiring = join(root, "packages/hkd-registry/src/index.ts");
      const typesExist = existsSync(typesFile);
      const wiringExists = existsSync(ecosystemWiring);
      return {
        pass: false,
        evidence: `VisualHKD type defined (types.ts exists=${typesExist}) but scoped to visual extraction only. Cross-ecosystem registry not found (hkd-registry/src/index.ts exists=${wiringExists}). Full claim "universal format powering the ecosystem" not satisfied.`,
      };
    },
  },

  {
    id: "a-resolve-kh-knowledge-features-real",
    universe: "feature",
    resolves: "c-knowledge-features-real",
    futureMilestone: "Knowledge Features: Knowledge Graph, Semantic Search, AI Reasoning, Source Attribution, Continuous Learning",
    probe({ root, join, existsSync }) {
      // Claim lists 5 features. kbs-runtime/src/{graph,search,provenance} cover
      // 3 of them as primitives. "AI Reasoning" and "Continuous Learning" have no
      // runtime implementation.
      const aiReasoningPath = join(root, "packages/kbs-runtime/src/reasoning");
      const continuousLearningPath = join(root, "packages/kbs-runtime/src/learning");
      const aiExists = existsSync(aiReasoningPath);
      const learningExists = existsSync(continuousLearningPath);
      return {
        pass: false,
        evidence: `AI Reasoning dir exists=${aiExists}, Continuous Learning dir exists=${learningExists}. Both aspirational — not implemented. Full 5-feature claim not satisfied.`,
      };
    },
  },

  {
    id: "a-resolve-kh-9-entity-types",
    universe: "hkd-runtime",
    resolves: "c-9-entity-types",
    futureMilestone: "9 HKD Entity Types: Concept/Entity/Person/Event/Location/Asset/Document/Observation/Evidence",
    probe({ root, join, readFileSync, existsSync }) {
      // Claim: exactly these 9 named types encoded in the type system.
      // types.ts has KbsNodeType with 10 different names:
      //   SOURCE, CLAIM, DOMAIN, CITATION, EVIDENCE, PERSON, EVENT, SCRIPT, MANUSCRIPT, ARTIFACT
      // HKDNode.kind is free-form string. The 9 named types from the claim are
      // not present as an enum/union anywhere.
      const typesFile = join(root, "packages/visual-hkd-runtime/src/types.ts");
      if (!existsSync(typesFile)) {
        return { pass: false, evidence: "types.ts not found" };
      }
      const src = readFileSync(typesFile, "utf8");
      const required = ["Concept", "Entity", "Person", "Event", "Location", "Asset", "Document", "Observation", "Evidence"];
      const found = required.filter((t) => src.includes(`"${t}"`));
      return {
        pass: false,
        evidence: `types.ts exists but HKDNode.kind is free-form string. Required named types as literals: found ${found.length}/9 (${found.join(",") || "none"}). KbsNodeType defines different 10-type set.`,
      };
    },
  },

  {
    id: "a-resolve-kh-9-relation-types",
    universe: "hkd-runtime",
    resolves: "c-9-relation-types",
    futureMilestone: "9 HKD Relation Types: IS_A/PART_OF/CAUSES/DEPENDS_ON/RELATED_TO/CREATED_BY/USES/SUPPORTS/CONTRADICTS",
    probe({ root, join, readFileSync, existsSync }) {
      // Claim: exactly these 9 named relation types encoded in the type system.
      // KbsEdgeType defines 8 different names (CITES, SUPPORTS, CONTRADICTS,
      // DERIVES_FROM, BELONGS_TO, TRANSLATES_TO, VERIFIED_BY, REVIEWED_BY).
      // HKDEdge.relation is free-form string.
      const typesFile = join(root, "packages/visual-hkd-runtime/src/types.ts");
      if (!existsSync(typesFile)) {
        return { pass: false, evidence: "types.ts not found" };
      }
      const src = readFileSync(typesFile, "utf8");
      const required = ["IS_A", "PART_OF", "CAUSES", "DEPENDS_ON", "RELATED_TO", "CREATED_BY", "USES", "SUPPORTS", "CONTRADICTS"];
      const found = required.filter((t) => src.includes(`"${t}"`));
      return {
        pass: false,
        evidence: `types.ts HKDEdge.relation is free-form string. Required named types as literals: found ${found.length}/9 (${found.join(",") || "none"}). KbsEdgeType defines a different 8-type set.`,
      };
    },
  },

  {
    id: "a-resolve-kh-hkd-runtime-active",
    universe: "hkd-runtime",
    resolves: "c-hkd-runtime-active",
    futureMilestone: "HKD Runtime/Compiler/Registry/Search/Validation/Ecosystem all Active",
    probe({ root, join, readFileSync, existsSync }) {
      // Claim: "all Active". runtime-knowledge-graph/src/index.ts health() returns
      // status:"scaffold". Compiler/Registry/Search Engine/Versioner/Permission Layer
      // do not exist as named active subsystems.
      const healthFile = join(root, "packages/runtime-knowledge-graph/src/index.ts");
      if (!existsSync(healthFile)) {
        return { pass: false, evidence: "runtime-knowledge-graph/src/index.ts not found" };
      }
      const src = readFileSync(healthFile, "utf8");
      const isScaffold = src.includes('status: "scaffold"');
      return {
        pass: false,
        evidence: `runtime-knowledge-graph health() status is scaffold (found=${isScaffold}). Claim requires "all Active" — scaffold disqualifies. Compiler/Registry/Versioner/Permission subsystems absent.`,
      };
    },
  },

  {
    id: "a-resolve-kh-validation-engine",
    universe: "hkd-runtime",
    resolves: "c-validation-engine",
    futureMilestone: "Validation Engine (Schema/Semantic/Evidence/Consistency/Sovereignty/Integrity/Tamper trust)",
    probe({ root, join, readFileSync, existsSync }) {
      // Claim requires 7 named validation stages. status-validator.ts implements
      // validateVisualHKDStatus which checks sourceImage presence and confidence
      // thresholds — one structural pass, not all 7 stages.
      const validatorFile = join(root, "packages/visual-hkd-runtime/src/status-validator.ts");
      if (!existsSync(validatorFile)) {
        return { pass: false, evidence: "status-validator.ts not found" };
      }
      const src = readFileSync(validatorFile, "utf8");
      const stages = ["Sovereignty", "Integrity", "Tamper", "Semantic", "Consistency"];
      const foundStages = stages.filter((s) => src.toLowerCase().includes(s.toLowerCase()));
      return {
        pass: false,
        evidence: `status-validator.ts exists with validateVisualHKDStatus (structural checks only). Claim requires 7 stages; stage keywords found: ${foundStages.length}/5 checked (${foundStages.join(",") || "none"}). Full 7-stage engine not present.`,
      };
    },
  },

  {
    id: "a-resolve-kh-10-graph-categories",
    universe: "knowledge-graph",
    resolves: "c-10-graph-categories",
    futureMilestone: "10 Graph Categories: Sutra/Person/Project/Asset/Memory/Chakra/Lipi/Investor/Knowledge Domain/Location",
    probe({ root, join, existsSync }) {
      // Claim: 10 distinct sub-graphs. kbs-graph is one unified graph.
      // Only Lipi sub-graph has substrate via lipi-runtime. 8 of 10 have none.
      const subGraphPaths = [
        "packages/graph-sutra",
        "packages/graph-person",
        "packages/graph-project",
        "packages/graph-asset",
        "packages/graph-memory",
        "packages/graph-chakra",
        "packages/graph-investor",
        "packages/graph-location",
      ];
      const missing = subGraphPaths.filter((p) => !existsSync(join(root, p)));
      return {
        pass: false,
        evidence: `kbs-graph is a single unified graph. ${missing.length}/${subGraphPaths.length} named sub-graph packages absent. Claim requires 10 distinct category graphs.`,
      };
    },
  },

  {
    id: "a-resolve-kh-capabilities-nl-query",
    universe: "knowledge-graph",
    resolves: "c-capabilities-nl-query",
    futureMilestone: "Capabilities: Semantic Search/Multi-Hop Reasoning/Contextual Inference/Pattern Discovery/Link Prediction/Anomaly Detection/Temporal Analysis/Viz Explorer/Graph Embeddings/Natural Language Query",
    probe({ root, join, readFileSync, existsSync }) {
      // Claim lists 10 capabilities. kbs-runtime/src/search has keywordSearch
      // (named semanticSearch but is keyword-only). No NL query, graph embeddings,
      // anomaly detection, temporal analysis, or link prediction code exists.
      const searchFile = join(root, "packages/kbs-runtime/src/search/index.ts");
      if (!existsSync(searchFile)) {
        return { pass: false, evidence: "kbs-runtime/src/search/index.ts not found" };
      }
      const src = readFileSync(searchFile, "utf8");
      const advanced = ["nlQuery", "graphEmbedding", "anomalyDetect", "linkPredict", "temporalAnalysis"];
      const found = advanced.filter((fn) => src.includes(fn));
      return {
        pass: false,
        evidence: `search/index.ts exists (keywordSearch + semanticSearch alias). Advanced capability functions found: ${found.length}/5 (${found.join(",") || "none"}). 9 of 10 claimed capabilities not implemented.`,
      };
    },
  },

  {
    id: "a-resolve-kh-usp-unified-kg",
    universe: "marketing",
    resolves: "c-usp-unified-kg",
    futureMilestone: "USP 07: Connects thousands of knowledge sources into one intelligent graph",
    probe({ root, join, readFileSync, existsSync }) {
      // Claim: "thousands of knowledge sources". kbs-runtime/src/data.ts defines
      // exactly 4 KbsSource records. Ingestion pipeline exists but no bulk loader.
      const dataFile = join(root, "packages/kbs-runtime/src/data.ts");
      if (!existsSync(dataFile)) {
        return { pass: false, evidence: "kbs-runtime/src/data.ts not found" };
      }
      const src = readFileSync(dataFile, "utf8");
      const sourceMatches = (src.match(/id: "source-/g) || []).length;
      return {
        pass: false,
        evidence: `kbs-runtime/src/data.ts defines ${sourceMatches} KbsSource records. Claim requires "thousands of knowledge sources" — not satisfied.`,
      };
    },
  },

  {
    id: "a-resolve-kh-knowledge-for-all-real",
    universe: "mission",
    resolves: "c-knowledge-for-all-real",
    futureMilestone: "Mission 2: Knowledge For All — democratize knowledge in every language",
    probe({ root, join, existsSync }) {
      // Claim: "every language". lipi-runtime supports specific Bharatiya scripts
      // (not every language). No i18n/translation runtime covering universal language
      // support exists.
      const i18nPaths = [
        "packages/runtime-translation",
        "packages/runtime-i18n",
        "packages/language-runtime",
      ];
      const found = i18nPaths.some((p) => existsSync(join(root, p)));
      return {
        pass: false,
        evidence: `Claim requires "every language" support. Checked ${i18nPaths.join(", ")}; anyFound=${found}. lipi-runtime covers specific Bharatiya scripts only — "every language" not satisfied.`,
      };
    },
  },

  {
    id: "a-resolve-kh-knowledge-graph-research",
    universe: "research",
    resolves: "c-knowledge-graph-research",
    futureMilestone: "Research Knowledge Graph (Hypothesis/Paper/Experiment/Dataset/Evidence/Author)",
    probe({ root, join, readFileSync, existsSync }) {
      // Claim requires research-specific entity types. KbsNodeType in types.ts
      // does not include Hypothesis, Paper, Experiment, Dataset, Author.
      const typesFile = join(root, "packages/kbs-runtime/src/types.ts");
      if (!existsSync(typesFile)) {
        return { pass: false, evidence: "kbs-runtime/src/types.ts not found" };
      }
      const src = readFileSync(typesFile, "utf8");
      const required = ["Hypothesis", "Paper", "Experiment", "Dataset", "Author"];
      const found = required.filter((t) => src.includes(t));
      return {
        pass: false,
        evidence: `kbs-runtime/src/types.ts defines KbsNodeType but does not include research entity types. Found: ${found.length}/5 (${found.join(",") || "none"}). Substrate present but research-specific types not defined.`,
      };
    },
  },

  {
    id: "a-resolve-kh-rt-knowledge-active",
    universe: "runtime",
    resolves: "c-rt-knowledge-active",
    futureMilestone: "Knowledge Runtime STATUS: ACTIVE",
    probe({ root, join, existsSync }) {
      // Claim: "@maataa/knowledge-runtime STATUS: ACTIVE". That package does not
      // exist (closest is @maataa/kbs-runtime which is name-mismatched and has no
      // "ACTIVE" status label). runtime-knowledge-graph is scaffold-only.
      const knowledgeRuntimePkg = join(root, "packages/knowledge-runtime/package.json");
      const exists = existsSync(knowledgeRuntimePkg);
      return {
        pass: false,
        evidence: `packages/knowledge-runtime/package.json exists=${exists}. No @maataa/knowledge-runtime package; kbs-runtime is real but name-mismatched and not labelled ACTIVE. runtime-knowledge-graph is scaffold. Claim not satisfied.`,
      };
    },
  },

  {
    id: "a-resolve-kh-knowledge-services-real",
    universe: "service",
    resolves: "c-knowledge-services-real",
    futureMilestone: "Knowledge Services (Knowledge Graph, Semantic Search, Sutra, AI Reasoning, Content Ingestion)",
    probe({ root, join, existsSync }) {
      // Claim: service-level exposure (HTTP endpoints, separate process).
      // kbs-sdk defines an OpenAPI spec but no HTTP server exists.
      const servicePaths = [
        "packages/kbs-service/src/server.ts",
        "packages/knowledge-service/src/index.ts",
        "apps/kbs-api/src/index.ts",
      ];
      const found = servicePaths.some((p) => existsSync(join(root, p)));
      return {
        pass: false,
        evidence: `No HTTP service package found; checked ${servicePaths.join(", ")}; anyFound=${found}. kbs-sdk has OpenAPI spec but no running service process. Claim not satisfied.`,
      };
    },
  },

  {
    id: "a-resolve-kh-connected-universes-hkd-kg",
    universe: "time-evolution",
    resolves: "c-connected-universes-hkd-kg",
    futureMilestone: "Connected Universes: HKD Knowledge + KG Graph integration",
    probe({ root, join, existsSync }) {
      // Claim: integration between HKD type system (visual-hkd-runtime) and
      // KG (kbs-graph) with temporal layer. Both packages exist separately;
      // no integration module or temporal layer present.
      const integrationPaths = [
        "packages/hkd-kg-bridge/src/index.ts",
        "packages/visual-hkd-runtime/src/kg-integration.ts",
        "packages/kbs-graph/src/hkd-bridge.ts",
      ];
      const found = integrationPaths.some((p) => existsSync(join(root, p)));
      return {
        pass: false,
        evidence: `No HKD-KG integration module found; checked ${integrationPaths.join(", ")}; anyFound=${found}. visual-hkd-runtime and kbs-graph exist as separate packages with no wiring. Temporal layer absent.`,
      };
    },
  },
];
