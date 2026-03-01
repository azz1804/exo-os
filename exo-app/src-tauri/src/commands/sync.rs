use serde::Serialize;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};

static SYNC_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
pub struct SyncResult {
    pub success: bool,
    pub message: String,
    pub output: String,
}

#[tauri::command]
pub fn trigger_sync() -> Result<SyncResult, String> {
    // Prevent concurrent syncs
    if SYNC_RUNNING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(SyncResult {
            success: false,
            message: "Sync already running".into(),
            output: String::new(),
        });
    }

    let orchestrator_path = get_orchestrator_path()?;

    let result = Command::new("node")
        .arg(&orchestrator_path)
        .current_dir(
            std::path::Path::new(&orchestrator_path)
                .parent()
                .unwrap_or(std::path::Path::new(".")),
        )
        .output();

    SYNC_RUNNING.store(false, Ordering::SeqCst);

    match result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let combined = if stderr.is_empty() {
                stdout
            } else {
                format!("{}\n--- STDERR ---\n{}", stdout, stderr)
            };

            Ok(SyncResult {
                success: output.status.success(),
                message: if output.status.success() {
                    "Sync completed successfully".into()
                } else {
                    format!("Sync failed with exit code: {:?}", output.status.code())
                },
                output: combined,
            })
        }
        Err(e) => Err(format!("Failed to start orchestrator: {}", e)),
    }
}

#[tauri::command]
pub fn is_sync_running() -> bool {
    SYNC_RUNNING.load(Ordering::SeqCst)
}

fn get_orchestrator_path() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let path = home
        .join("Exo OS")
        .join("mcp-client-orchestrator")
        .join("orchestrator.js");

    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(format!("Orchestrator not found at {:?}", path))
    }
}
