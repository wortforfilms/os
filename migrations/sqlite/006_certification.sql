-- Certification gate registry for PHKD promotion decisions.
-- A certification cannot be marked PASS without all hard-gate booleans set.

CREATE TABLE IF NOT EXISTS certification_gates (
    certification_id TEXT PRIMARY KEY,
    target_ref TEXT NOT NULL,
    system_state_word INTEGER NOT NULL,
    monotonic_time_verified INTEGER NOT NULL CHECK(monotonic_time_verified IN (0, 1)),
    dataset_locks_verified INTEGER NOT NULL CHECK(dataset_locks_verified IN (0, 1)),
    evidence_bundle_verified INTEGER NOT NULL CHECK(evidence_bundle_verified IN (0, 1)),
    recovery_drill_verified INTEGER NOT NULL CHECK(recovery_drill_verified IN (0, 1)),
    no_go_reason TEXT,
    verdict TEXT NOT NULL CHECK(verdict IN ('SCIENTIFIC_CERTIFIED', 'CONTROLLED_NO_GO')),
    certified_at_epoch INTEGER NOT NULL,
    CHECK (
        verdict = 'CONTROLLED_NO_GO'
        OR (
            monotonic_time_verified = 1
            AND dataset_locks_verified = 1
            AND evidence_bundle_verified = 1
            AND recovery_drill_verified = 1
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_certification_gates_verdict
    ON certification_gates(verdict, certified_at_epoch);
