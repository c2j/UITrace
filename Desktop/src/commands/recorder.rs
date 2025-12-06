use crate::recorder::{BrowserExtension, WebRecorder, RecordingConfig};
use crate::models::test_step::TestStep;
use crate::models::script::TestScript;
use crate::AppState;
use serde_json::Value;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager, State};
use std::sync::{Arc, Mutex};

#[command]
pub async fn start_recording(
    app: AppHandle,
    url: Option<String>,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    let mut is_recording = state.is_recording.lock().unwrap();

    if *is_recording {
        return Err("Already recording".to_string());
    }

    // Create browser extension for recording
    let (extension, _receiver) = BrowserExtension::new();
    let session_id = uuid::Uuid::new_v4().to_string();

    // Mark as recording
    *is_recording = true;

    // If URL is provided, we could navigate to it via WebDriver
    if let Some(url) = url {
        log::info!("Starting recording for URL: {}", url);
        // TODO: Implement WebDriver navigation if needed
    }

    // Store extension in app state for later use
    app.manage(Arc::new(Mutex::new(extension)));

    Ok(session_id)
}

#[command]
pub async fn stop_recording(
    app: AppHandle,
) -> Result<Vec<TestStep>, String> {
    let state = app.state::<AppState>();
    let mut is_recording = state.is_recording.lock().unwrap();

    if !*is_recording {
        return Err("Not currently recording".to_string());
    }

    // Stop recording
    *is_recording = false;

    // For now, return empty steps - in a real implementation,
    // we would collect steps from the browser extension
    let steps = Vec::new();

    Ok(steps)
}

#[command]
pub async fn save_recording(
    app: AppHandle,
    name: String,
    description: Option<String>,
    steps: Vec<TestStep>,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    let created_by = "uitrace_user".to_string(); // TODO: Get from auth state

    // Create test script from steps
    let mut script = TestScript::new(name, created_by)
        .with_description(description.unwrap_or_else(|| "".to_string()));

    // Add steps to script
    for step in steps {
        script.steps.push(step);
    }

    // Store in current script
    let mut current_script = state.current_script.lock().unwrap();
    *current_script = Some(script.clone());

    // Serialize and save script
    let script_json = script.to_json()
        .map_err(|e| format!("Failed to serialize script: {}", e))?;

    // Save to local storage (for now, just log it)
    log::info!("Script saved: {}", script.name);
    log::debug!("Script content: {}", script_json);

    Ok(script.id)
}

#[command]
pub async fn load_recording(
    app: AppHandle,
    script_id: String,
) -> Result<TestScript, String> {
    let state = app.state::<AppState>();

    // For now, just return the current script
    let current_script = state.current_script.lock().unwrap();

    if let Some(script) = current_script.as_ref() {
        if script.id == script_id {
            return Ok(script.clone());
        }
    }

    Err("Script not found".to_string())
}

#[command]
pub async fn capture_dom_event(
    app: AppHandle,
    event: Value,
) -> Result<bool, String> {
    let state = app.state::<AppState>();
    let is_recording = state.is_recording.lock().unwrap();

    if !*is_recording {
        return Ok(false);
    }

    // Parse the DOM event
    let event_type = event.get("type").and_then(|v| v.as_str()).unwrap_or("unknown");

    match event_type {
        "click" | "type" | "navigation" | "scroll" => {
            // TODO: Process the event and convert to TestStep
            log::info!("Captured {} event: {:?}", event_type, event);
            Ok(true)
        }
        _ => {
            log::warn!("Unknown event type: {}", event_type);
            Ok(false)
        }
    }
}