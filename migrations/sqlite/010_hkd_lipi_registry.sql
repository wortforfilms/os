-- Generated HKD Lipi Registry SQLite schema.
-- PHKD defaults: runtime disabled, evidence required, unknown data explicit.

CREATE TABLE IF NOT EXISTS hkd_lipi_script_registry (
  id TEXT PRIMARY KEY,
  registry_index INTEGER NOT NULL UNIQUE CHECK (registry_index BETWEEN 1 AND 426),
  display_name TEXT NOT NULL,
  native_name TEXT NOT NULL DEFAULT 'UNKNOWN',
  registry_class TEXT NOT NULL CHECK (registry_class IN ('unicode','historic','liturgical','undeciphered','shorthand','notation','symbol','hkd_private')),
  script_family TEXT NOT NULL DEFAULT 'UNKNOWN',
  parent_script TEXT NOT NULL DEFAULT 'UNKNOWN',
  region_primary TEXT NOT NULL DEFAULT 'UNKNOWN',
  unicode_script_value TEXT NOT NULL DEFAULT 'UNKNOWN',
  unicode_script_alias TEXT NOT NULL DEFAULT 'UNKNOWN',
  iso15924 TEXT NOT NULL DEFAULT 'UNKNOWN',
  unicode_version_added TEXT NOT NULL DEFAULT 'UNKNOWN',
  unicode_status TEXT NOT NULL CHECK (unicode_status IN ('encoded','partially_encoded','unencoded','proposed','private')),
  script_property_kind TEXT NOT NULL CHECK (script_property_kind IN ('explicit','common','inherited','unknown','non_unicode')),
  writing_system_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  joining_behavior TEXT NOT NULL,
  casing_behavior TEXT NOT NULL,
  has_decimal_digits TEXT NOT NULL DEFAULT 'UNKNOWN',
  zero_glyph TEXT NOT NULL DEFAULT 'UNKNOWN',
  numeral_system_type TEXT NOT NULL DEFAULT 'UNKNOWN',
  font_support_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  cultural_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  evidence_status TEXT NOT NULL CHECK (evidence_status IN ('verified','scholarly','disputed','draft','unknown')),
  hkd_runtime_enabled INTEGER NOT NULL DEFAULT 0 CHECK (hkd_runtime_enabled IN (0,1)),
  lipi_ai_priority TEXT NOT NULL DEFAULT 'review',
  kbs_node_id TEXT NOT NULL UNIQUE,
  normalization_notes TEXT NOT NULL DEFAULT 'UNKNOWN',
  collation_notes TEXT NOT NULL DEFAULT 'UNKNOWN',
  provenance_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hkd_lipi_script_alternate_name (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_script_region (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), region TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_script_language (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), language TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_unicode_block (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), block_name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_unicode_range (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), range_label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_script_extension_value (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), script_alias TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_character_inventory (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), inventory_kind TEXT NOT NULL, token TEXT NOT NULL, evidence_status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_digit_inventory (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), digit_index INTEGER NOT NULL CHECK (digit_index BETWEEN 0 AND 9), glyph TEXT NOT NULL, evidence_status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_font_support (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), font_id TEXT NOT NULL, support_status TEXT NOT NULL, evidence_status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_transliteration (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), system_id TEXT NOT NULL, evidence_status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_lineage_edge (id TEXT PRIMARY KEY, parent_script_id TEXT NOT NULL, child_script_id TEXT NOT NULL, relation_type TEXT NOT NULL, evidence_status TEXT NOT NULL, source_refs_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_evidence_ref (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), source_ref_id TEXT NOT NULL, claim_scope TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_provenance_event (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), event_type TEXT NOT NULL, field_name TEXT NOT NULL, source_refs_json TEXT NOT NULL, previous_hash TEXT NOT NULL, event_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_search_document (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), document_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_kbs_edge (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, predicate TEXT NOT NULL, object_id TEXT NOT NULL, evidence_status TEXT NOT NULL, source_refs_json TEXT NOT NULL);
