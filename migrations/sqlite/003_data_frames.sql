-- Maataa OS universal runtime data frames.
-- Local-only SQLite schema; no remote telemetry or external sync hooks.

CREATE TABLE IF NOT EXISTS monorepo_stack_registry (
    stack_layer TEXT PRIMARY KEY,
    technology TEXT NOT NULL,
    telemetry_hook TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS communication_queue (
    event_id TEXT PRIMARY KEY,
    payload_type TEXT NOT NULL CHECK(payload_type IN ('NEWSLETTERS', 'INBOX', 'NOTIFICATIONS', 'ALERTS')),
    current_state TEXT NOT NULL CHECK(current_state IN ('EVENT', 'QUEUE', 'RETRY', 'ADAPTER', 'SSE', 'INBOX')),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK(retry_count >= 0),
    timestamp_epoch INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS brahmini_asset_ledger (
    token_id TEXT PRIMARY KEY,
    token_type TEXT NOT NULL CHECK(token_type IN ('ERC-20', 'ERC-1155', 'Soulbound')),
    metadata_ipfs_hash TEXT NOT NULL,
    chakra_gating_mask INTEGER NOT NULL,
    identity_signature TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_communication_queue_state
    ON communication_queue(current_state, timestamp_epoch);

CREATE INDEX IF NOT EXISTS idx_brahmini_asset_ledger_type
    ON brahmini_asset_ledger(token_type);
