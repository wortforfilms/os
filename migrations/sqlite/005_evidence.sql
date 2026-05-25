-- Local evidence bundle registry.
-- Each row binds a deterministic artifact digest to a local promotion gate.

CREATE TABLE IF NOT EXISTS evidence_bundles (
    evidence_id TEXT PRIMARY KEY,
    subsystem_id TEXT NOT NULL,
    artifact_path TEXT NOT NULL,
    sha256 TEXT NOT NULL CHECK(length(sha256) = 64),
    signature_path TEXT,
    governance_state TEXT NOT NULL CHECK(governance_state IN (
        'RAW',
        'NORMALIZED',
        'VALIDATED_PREVIEW',
        'REFERENCE_VALIDATED',
        'SIGNED',
        'SCIENTIFIC_CERTIFIED'
    )),
    created_at_epoch INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_replay_log (
    replay_id TEXT PRIMARY KEY,
    evidence_id TEXT NOT NULL REFERENCES evidence_bundles(evidence_id),
    replay_status TEXT NOT NULL CHECK(replay_status IN ('PASS', 'BLOCKED')),
    mosf_status_word INTEGER NOT NULL,
    diagnostics TEXT NOT NULL,
    replayed_at_epoch INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_subsystem
    ON evidence_bundles(subsystem_id, governance_state);
