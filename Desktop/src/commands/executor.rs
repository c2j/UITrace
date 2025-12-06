use crate::executor::{ScriptExecutor, ExecutionConfig};
use crate::models::ExecutionResult;
use crate::models::{TestScript, TestData};
use serde_json::Value;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager};

#[command]
pub async fn execute_script(
    app: AppHandle,
    script_path: PathBuf,
    test_data: Option<TestData>,
    config: Option<ExecutionConfig>,
) -> Result<String, String> {
    let executor = ScriptExecutor::new(config.unwrap_or_default());
    let execution_id = executor.execute_script(&script_path, test_data).await
        .map_err(|e| format!("Failed to execute script: {}", e))?;

    // Store executor in app state for potential stop operation
    app.manage(executor);

    Ok(execution_id)
}

#[command]
pub async fn stop_execution(app: AppHandle) -> Result<ExecutionResult, String> {
    let executor = app.state::<ScriptExecutor>();
    executor.stop_execution().await
        .map_err(|e| format!("Failed to stop execution: {}", e))
}

#[command]
pub async fn get_execution_status(app: AppHandle, execution_id: String) -> Result<Value, String> {
    let executor = app.state::<ScriptExecutor>();
    executor.get_execution_status(&execution_id).await
        .map_err(|e| format!("Failed to get execution status: {}", e))
}