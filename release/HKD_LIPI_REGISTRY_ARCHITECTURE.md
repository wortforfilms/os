# HKD Lipi Registry Architecture

Generated: 2026-06-17T00:31:50.727Z

Review state: **CONTROLLED_NO_GO**  
Governed production GO: **false**

This is a production-grade registry contract, not a certification claim. It can store 426 script-system records across Unicode scripts, historic scripts, liturgical scripts, undeciphered systems, shorthand, notation, symbol systems, and HKD private research extensions. Runtime enablement remains fail-closed.

## 1. Registry Taxonomy

Partitions:

- A: Unicode Scripts (unicode) - Rows generated from UCD Script property values only.
- B: Historic Scripts (historic) - Encoded historic scripts use UCD; unencoded historic scripts stay UNENCODED with scholarly evidence.
- C: Liturgical Scripts (liturgical) - Liturgical status is cultural metadata, separate from Unicode encoding.
- D: Undeciphered Systems (undeciphered) - DISPUTED or SCHOLARLY; no OCR/transliteration/runtime claims.
- E: Shorthand Systems (shorthand) - Encoded systems use UCD; unencoded systems remain UNENCODED.
- F: Notation Systems (notation) - Notation blocks are symbol/notation records, not Script property inventions.
- G: Symbol Systems (symbol) - Symbol systems require block/provenance boundaries.
- H: HKD Extensions (hkd_private) - Private/research rows cannot claim Unicode or ISO assignment.

PHKD rules:

- Never invent Unicode assignments.
- Never invent ISO 15924 codes.
- Mark uncertain information as UNKNOWN.
- Mark unencoded systems as UNENCODED.
- Mark disputed systems as DISPUTED.
- Separate verified facts from research hypotheses.
- Every record must contain provenance.
- Fail closed rather than hallucinate.

## 2. Database Schema

- script_registry: Canonical 426-row script-system registry; PHKD fact fields stay UNKNOWN unless sourced.
- script_alternate_name: Alternate script names, aliases, source spellings.
- script_region: Many-to-many region coverage.
- script_language: Many-to-many language coverage.
- script_unicode_block: Script-to-Unicode-block crosswalk.
- script_unicode_range: Script-to-code-point-range crosswalk.
- script_extension_value: Script_Extensions aliases from UCD where applicable.
- script_character_inventory: Vowels, consonants, matras, ligatures, punctuation, symbols.
- script_digit_inventory: Digits 0-9 and zero glyph per source.
- script_font_support: Font registry join with support posture.
- script_transliteration: Script-to-transliteration system join.
- script_lineage_edge: Family tree and hypothesis lineage edges with evidence status.
- script_evidence_ref: Evidence bundle references and claim boundaries.
- script_provenance_event: Immutable provenance events for field-level changes.
- script_search_document: Flattened search index row.
- script_kbs_edge: KBS graph edge export.

## 3. TypeScript Types

Generated at `packages/lipi-runtime/src/registry/hkd-lipi-registry-types.ts`.

## 4. Prisma Models

Generated at `packages/lipi-runtime/prisma/hkd-lipi-registry.prisma`.

## 5. SQLite DDL

Generated at `migrations/sqlite/010_hkd_lipi_registry.sql`.

## 6. PostgreSQL DDL

Generated at `migrations/postgresql/010_hkd_lipi_registry.sql`.

## 7. JSON Schema

Generated at `schemas/hkd-lipi-script-registry.schema.json`.

## 8. Graph Schema

Nodes: Script, Language, Region, Dynasty, Manuscript, Inscription, Font, UnicodeBlock, UnicodeRange, NumeralSystem, TransliterationSystem, EvidenceSource, ProvenanceEvent

Edges: SCRIPT_USES_LANGUAGE, SCRIPT_ATTESTED_IN_REGION, SCRIPT_DERIVES_FROM_SCRIPT, SCRIPT_HAS_UNICODE_BLOCK, SCRIPT_HAS_UNICODE_RANGE, SCRIPT_HAS_NUMERAL_SYSTEM, SCRIPT_SUPPORTS_TRANSLITERATION, SCRIPT_RENDERED_BY_FONT, SCRIPT_HAS_EVIDENCE, EVIDENCE_HAS_PROVENANCE, INSCRIPTION_WRITTEN_IN_SCRIPT, MANUSCRIPT_WRITTEN_IN_SCRIPT, DYNASTY_PATRONIZED_SCRIPT

## 9. Search Index Schema

Index: `hkd_lipi_script_registry`, primary key `id`.

## 10. KBS Ontology

Namespace: `hkd.lipi.registry`. Every assertion is evidence-bound.

## 11. API Contracts

- GET /scripts -> ScriptRegistryListResponse
- GET /scripts/{id} -> ScriptRegistryRecordResponse
- GET /unicode/crosswalk -> UnicodeCrosswalkResponse
- GET /families/{family}/tree -> ScriptFamilyTreeResponse
- GET /scripts/{id}/evidence -> EvidenceBundleResponse
- POST /scripts/{id}/review -> ReviewDecisionResponse
- POST /scripts/{id}/runtime-enable -> RuntimeEnableResponse

## 12. Unicode Mapping Tables

- Unicode version: 17.0.0
- Script property values: 176
- Crosswalk rows: 176
- Unicode rows in 426 seed: 176

## 13. Script Family Trees

- Brahmi: Gupta, Sharada, Takri, Devanagari, Bengali, Gujarati, Gurmukhi, Odia, Telugu, Kannada, Malayalam, Tamil

## 14. Transliteration Registry

- IAST: Indic/Sanskrit
- ISO 15919: Indic transliteration
- Harvard-Kyoto: Sanskrit ASCII
- ITRANS: Indic ASCII
- Velthuis: Devanagari/Sanskrit ASCII
- WX: Indian languages
- SLP1: Sanskrit computational

## 15. Numeral Registry

- Brahmi Numerals: additive
- Gupta Numerals: positional
- Nagari Numerals: decimal
- Modern Indic Numerals: decimal

Numeral evolution: Brahmi Numerals -> Gupta -> Nagari -> Modern Indic Numerals

## 16. Glyph Registry

Glyph records are separated from script records; glyphs require code point/provenance/font-render proof before runtime use.

## 17. Font Registry

- Noto: multi-script
- Lohit: Indic
- Sanskrit2003: Sanskrit/Devanagari
- Chandas: Vedic/Sanskrit
- Mukta: Indic UI
- Adishila: Indic epigraphy candidate

## 18. Rendering Registry

- OpenType: font shaping tables
- Graphite: smart font behavior
- HarfBuzz: complex text shaping
- ICU: segmentation, collation, transforms
- Unicode Normalization: NFC/NFD/NFKC/NFKD policy

## 19. Evidence Registry

States: verified, scholarly, disputed, draft, unknown

## 20. Provenance Registry

Events: source_ingested, field_asserted, field_changed, review_requested, review_accepted, review_rejected, runtime_enabled, runtime_disabled

## Seed Dataset Structure

- Target capacity: 426/426
- Unicode property rows: 176
- Non-Unicode research rows: 27
- Reserved HKD evidence slots: 223
- Runtime enabled rows: 0

First 20 rows:

- 1. Adlam [unicode; encoded; verified]
- 2. Caucasian Albanian [unicode; encoded; verified]
- 3. Ahom [unicode; encoded; verified]
- 4. Arabic [unicode; encoded; verified]
- 5. Imperial Aramaic [unicode; encoded; verified]
- 6. Armenian [unicode; encoded; verified]
- 7. Avestan [unicode; encoded; verified]
- 8. Balinese [unicode; encoded; verified]
- 9. Bamum [unicode; encoded; verified]
- 10. Bassa Vah [unicode; encoded; verified]
- 11. Batak [unicode; encoded; verified]
- 12. Bengali [unicode; encoded; verified]
- 13. Beria Erfe [unicode; encoded; verified]
- 14. Bhaiksuki [unicode; encoded; verified]
- 15. Bopomofo [unicode; encoded; verified]
- 16. Brahmi [unicode; encoded; verified]
- 17. Braille [unicode; encoded; verified]
- 18. Buginese [unicode; encoded; verified]
- 19. Buhid [unicode; encoded; verified]
- 20. Chakma [unicode; encoded; verified]

## Validation Rules

- registry_index must be unique and between 1 and 426.
- id must be unique and stable.
- source_refs must contain at least one source id.
- provenance must be present for every row.
- unicode_status=encoded or partially_encoded requires either unicode_ranges or a non-Unicode symbol/notation block source.
- unicode_status=unencoded requires empty unicode_script_alias or UNKNOWN unless a Unicode property row has no assigned range.
- iso15924 must be UNKNOWN unless copied from an authoritative source field.
- evidence_status=verified requires primary source_refs.
- hkd_runtime_enabled=true requires evidence_status=verified and no UNKNOWN in required rendering/transliteration gates.
- undeciphered systems must not expose transliteration/OCR/translation runtime claims.

## Source Provenance

- unicode-ucd-17-property-value-aliases: https://www.unicode.org/Public/UCD/latest/ucd/PropertyValueAliases.txt
- unicode-ucd-17-scripts: https://www.unicode.org/Public/UCD/latest/ucd/Scripts.txt
- unicode-ucd-17-script-extensions: https://www.unicode.org/Public/UCD/latest/ucd/ScriptExtensions.txt
- unicode-ucd-17-blocks: https://www.unicode.org/Public/UCD/latest/ucd/Blocks.txt
- unicode-ucd-17-derived-age: https://www.unicode.org/Public/UCD/latest/ucd/DerivedAge.txt
- maataa-lipi-426-master-timeline: release/evidence/lipi-426-master-timeline.json
- hkd-registry-architect-user-prompt: HKD Lipi Registry Architect prompt, 2026-06-17
