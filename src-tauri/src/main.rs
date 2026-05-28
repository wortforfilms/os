#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            support_docs,
            support_status,
            sovereign_ascii_status,
            sovereign_ascii_frame
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
