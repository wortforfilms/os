-- Maataa OS universal runtime data frames.
-- Local-only SQLite schema; no remote telemetry or external sync hooks.

CREATE TABLE IF NOT EXISTS monorepo_stack_registry (
    stack_layer TEXT PRIMARY KEY CHECK(stack_layer IN (
        'Web',
        'Desktop',
        'Runtime',
        'Database',
        'ORM',
        'Streaming',
        'Media',
        'Infra',
        'Observability',
        'UI'
    )),
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

INSERT OR REPLACE INTO monorepo_stack_registry VALUES
    ('Web', 'Vite React cockpit on local port 1420', 'Loopback binary telemetry stream'),
    ('Desktop', 'Tauri and Electron local shells', 'Native IPC command channel'),
    ('Runtime', 'TypeScript and Rust core', 'C-packed shared memory'),
    ('Database', 'SQLite embedded file engine', 'Local write-ahead logging'),
    ('Streaming', 'Loopback Server-Sent Events', '127.0.0.1 telemetry source'),
    ('Media', 'Local generation toolchain staging', 'Offline asset validation receipts'),
    ('Infra', 'QEMU alpha and golden-image scripts', 'Local release reports'),
    ('Observability', 'Evidence runtime pressure harness', 'MOSF and HST verification frames'),
    ('UI', 'Maataa UI sovereign dashboard', 'Runtime recovery state boundary');
