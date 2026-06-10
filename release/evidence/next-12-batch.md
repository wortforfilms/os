# MAATAA OS Next 12 Batch

- Batch: `next-12-20260609-0b99044fc18c`
- Generated: 2026-06-09T02:49:15.315Z
- Source queue: `data/next-in-line.json` (2026-06-09T02:49:05.362Z)
- Source cycle: `release/evidence/milestones-cycle-last.json` (2026-06-09T02:49:05.663Z)
- Source tally: 167/654 achieved
- Mode: next-queue

> This is not progress evidence. Every item remains blocked until real code, focused tests, and regenerated evidence prove it.

## Items

### 1. Lipi Agent — revives languages & scripts (NLP/OCR/translation)

- Group: Knowledge & Intelligence
- Source rank: 1
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: lipi-runtime (real package) provides transliteration/learning/lineage primitives. Agent wrapper does not exist.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 2. AI Capabilities: Understand (NLU) / Reason & Infer / Generate & Create / Perceive & Interpret / Plan & Decide / Remember & Learn / Act & Automate / Collaborate

- Group: Knowledge & Intelligence
- Source rank: 2
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: kbs-runtime/src/{search,claims,reasoning} provides Understand+Reason substrate. visual-hkd-runtime provides Perceive+Interpret for vision boards. Generate/Plan/Act runtimes not present.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 3. Formats: 120+

- Group: Economy & Identity
- Source rank: 3
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: 120+ file formats is generic count; the repo handles a small subset (HTML, MD, JSON, PNG, etc.). No format conversion runtime.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 4. Lipi Glyphs Library: 15,000+ glyphs across Brahmi/Kharoshthi/Devanagari/Siddham

- Group: Economy & Identity
- Source rank: 4
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: lipi-runtime/src/characters provides script-character primitives. 15K specific glyph assets are not stored as a library.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 5. Powered By: LIPI Language & Script

- Group: Civilization & Domains
- Source rank: 5
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: lipi-runtime is real; civilizational integration is aspirational.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 6. ERD: users / profiles / roles / permissions / projects / tasks / milestones / knowledge_nodes / knowledge_relations / knowledge_sources / documents / assets / events

- Group: Civilization & Domains
- Source rank: 6
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: lipi-runtime/prisma/schema.prisma contains a real subset (lipi-domain tables). The board's 13-table ERD is broader and not implemented.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 7. Values Embodied: 12

- Group: Governance & Evidence
- Source rank: 7
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: The 12 values (Yamas+Niyamas extended) are catalogued correctly; 'embodied' as a measured property is not defined.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 8. HKD (Human Knowledge Data) is the universal knowledge format powering the ecosystem

- Group: Civilization & Domains
- Source rank: 8
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: visual-hkd-runtime defines an HKD type system and pipeline. It is real but narrow: extraction from visual sources to knowledge-graph projections. It is not (yet) wired as the universal cross-ecosystem format.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 9. Knowledge Features (Knowledge Graph, Semantic Search, AI Reasoning, Source Attribution, Continuous Learning)

- Group: Apps & Experience
- Source rank: 9
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: kbs-runtime/src/{graph,search,claims,provenance,ingestion} provide the underlying capabilities. 'Continuous Learning' as a runtime is aspirational.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 10. Lipi Features (Brahmi, Kharoshthi, Devanagari, Multi-direction, RTL/LTR/TTB, Custom Fonts, Lipi Learning Engine)

- Group: Apps & Experience
- Source rank: 10
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: lipi-runtime/src/{characters,phonetics,registry,learning,search,governance} implement many of these. Indus Script Research is marked '(Research)' on board image 1 — appropriate.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 11. Policy Lifecycle: Draft→Consult→Vote→Enact→Implement→Review→Evolve

- Group: Governance & Evidence
- Source rank: 11
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: kbs-governance has policy primitives (evaluateKbsGate, rejectProductionClaim). scripts/governed-production-gate.mjs implements an Enact→Implement gate for releases. Full lifecycle is not wired.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

### 12. 9 HKD Entity Types: Concept / Entity / Person / Event / Location / Asset / Document / Observation / Evidence

- Group: Platform & Runtime
- Source rank: 12
- Source kind: in-progress-claim
- Status: BLOCKED_CANDIDATE_ONLY
- Evidence: CLAIM_PARTIAL_UNTIL_REAL_BUILD_SCOPED
- Completion probe: not-yet-assigned
- Completed at: not completed
- Detail: VisualHKD's HKDNode has a `kind: string` field — entity types are user-defined. The 9 named types are a sensible taxonomy but not encoded in the type system.
- Required to flip: scope a concrete real-build; code implementation; passing focused test; milestones/evidence regeneration

