use tauri::Manager;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod models;
mod services;
mod recorder;
mod executor;
mod visual;
mod data;
mod utils;

use models::{ApiResponse, TestScript, ExecutionResult};
use uuid::Uuid;

#[tauri::command]
async fn greet(name: String) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn create_test_script(name: String, description: Option<String>) -> Result<ApiResponse<TestScript>, String> {
    info!("Creating test script: {}", name);

    let mut script = TestScript::new(name, description);

    match script.validate() {
        Ok(()) => {
            info!("Test script created successfully: {}", script.id);
            Ok(ApiResponse::success(script))
        }
        Err(e) => {
            error!("Failed to create test script: {}", e);
            Ok(ApiResponse::error(e))
        }
    }
}

#[tauri::command]
async fn get_script_info(script_id: String) -> Result<ApiResponse<TestScript>, String> {
    info!("Getting script info for: {}", script_id);

    // TODO: Implement actual script loading from storage
    let script = TestScript::new("Sample Script".to_string(), Some("A sample test script".to_string()));

    Ok(ApiResponse::success(script))
}

#[tauri::command]
async fn execute_script(script_id: String) -> Result<ApiResponse<ExecutionResult>, String> {
    info!("Executing script: {}", script_id);

    // TODO: Implement actual script execution
    let mut result = ExecutionResult::new(Uuid::parse_str(&script_id).map_err(|e| e.to_string())?);
    result.complete();

    Ok(ApiResponse::success(result))
}

fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "uitrace_desktop=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting UITrace Desktop Application");

    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            create_test_script,
            get_script_info,
            execute_script
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
