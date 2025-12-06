use crate::recorder::{WebRecorder, RecordingConfig};
use crate::models::Recording;
use serde_json::Value;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager};

#[command]
pub async fn start_recording(
    app: AppHandle,
    url: String,
    config: Option<RecordingConfig>,
) -> Result<String, String> {
    let mut recorder = WebRecorder::new(config.unwrap_or_default());
    let session_id = recorder.start_recording(&url).await
        .map_err(|e| format!("Failed to start recording: {}", e))?;

    // Store recorder in app state
    app.manage(recorder);

    Ok(session_id)
}

#[command]
pub async fn stop_recording(app: AppHandle) -> Result<Recording, String> {
    // Remove recorder from app state and stop it
    let _recorder = app.state::<WebRecorder>();
    // This approach needs to be reconsidered for proper state management
    // For now, return an error
    Err("Not implemented: Need to redesign recorder state management".to_string())
}

#[command]
pub async fn save_recording(
    app: AppHandle,
    path: PathBuf,
    metadata: Option<Value>,
) -> Result<(), String> {
    let recorder = app.state::<WebRecorder>();
    recorder.save_recording(&path, metadata).await
        .map_err(|e| format!("Failed to save recording: {}", e))
}