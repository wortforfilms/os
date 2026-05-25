-- Hemant Samwat temporal state registry.
-- Stores local monotonic epoch attestations only; no wall-clock or remote transport dependency.

CREATE TABLE IF NOT EXISTS hsts_state_words (
    state_id TEXT PRIMARY KEY,
    elapsed_nanos INTEGER NOT NULL CHECK(elapsed_nanos >= 0),
    state_sequence INTEGER NOT NULL CHECK(state_sequence >= 0),
    absolute_epoch_nanos INTEGER NOT NULL CHECK(absolute_epoch_nanos >= elapsed_nanos),
    operational_mask INTEGER NOT NULL,
    integrity_hash INTEGER NOT NULL,
    scientific_certified INTEGER NOT NULL CHECK(scientific_certified IN (0, 1)),
    recorded_at_epoch INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hsts_state_words_sequence
    ON hsts_state_words(state_sequence);
