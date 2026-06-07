use std::time::{SystemTime, UNIX_EPOCH};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            support_docs,
            support_status,
            sovereign_ascii_status,
            sovereign_ascii_frame,
            runtime_events_since,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Maataa OS desktop shell");
}

fn main() {
    run();
}

#[tauri::command]
fn support_docs() -> serde_json::Value {
    serde_json::from_str(include_str!("../../data/support-docs.json"))
        .expect("support docs manifest must be valid JSON")
}

#[derive(serde::Serialize)]
struct RuntimeEvent {
    id: u64,
    #[serde(rename = "type")]
    event_type: &'static str,
    at: u128,
    title: &'static str,
    detail: String,
    status: &'static str,
}

#[derive(serde::Serialize)]
struct RuntimeEventBatch {
    ok: bool,
    cursor: u64,
    events: Vec<RuntimeEvent>,
    blockedSystemsCount: usize,
    transport: &'static str,
}

#[tauri::command]
fn runtime_events_since(cursor: u64) -> RuntimeEventBatch {
    let manifest: serde_json::Value = serde_json::from_str(include_str!("../../COMPLETION_STATUS_MATRIX.json"))
        .expect("completion status matrix must be valid JSON");

    let blocked_count = manifest
        .get("blockers")
        .and_then(|value| value.as_array())
        .map(|items| items.len())
        .unwrap_or(0);

    let final_status = manifest
        .get("finalStatus")
        .and_then(|value| value.as_str())
        .unwrap_or("UNKNOWN");

    let next_cursor = cursor.saturating_add(1);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_millis();

    RuntimeEventBatch {
        ok: true,
        cursor: next_cursor,
        blockedSystemsCount: blocked_count,
        transport: "electron-ipc",
        events: vec![RuntimeEvent {
            id: next_cursor,
            event_type: "heartbeat",
            at: now,
            title: "Tauri heartbeat",
            detail: format!(
                "Local Tauri runtime event stream; blockers={} finalStatus={}",
                blocked_count, final_status
            ),
            status: "LIVE",
        }],
    }
}

#[tauri::command]
fn support_status() -> SupportStatus {
    SupportStatus {
        shell: "tauri",
        production_ready: false,
        final_status: "GOVERNED_PRODUCTION_NO_GO",
        support_mode: "PREVIEW_AND_LOCAL_VALIDATION",
    }
}

#[tauri::command]
fn sovereign_ascii_status() -> SovereignAsciiStatus {
    SovereignAsciiStatus {
        shell: "tauri",
        mode: "CONTROLLED_CONVERGENCE",
        production_ready: false,
        final_status: "GOVERNED_PRODUCTION_NO_GO",
        phkd_verdict: "BLOCKED",
        no_fake_claims: true,
    }
}

#[tauri::command]
fn sovereign_ascii_frame() -> serde_json::Value {
    serde_json::from_str(include_str!("../../data/sovereign-runtime-ascii-tauri.json"))
        .expect("sovereign runtime ASCII manifest must be valid JSON")
}

#[derive(serde::Serialize)]
struct SupportStatus {
    shell: &'static str,
    production_ready: bool,
    final_status: &'static str,
    support_mode: &'static str,
}

#[derive(serde::Serialize)]
struct SovereignAsciiStatus {
    shell: &'static str,
    mode: &'static str,
    production_ready: bool,
    final_status: &'static str,
    phkd_verdict: &'static str,
    no_fake_claims: bool,
}
