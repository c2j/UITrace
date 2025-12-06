use crate::data::{DataManager, DataSource};
use crate::models::{TestData, TestDataRow};
use crate::utils::error_handler::UITraceError;
use serde_json::Value;
use std::path::PathBuf;
use tauri::command;

#[command]
pub async fn load_test_data(
    data_path: PathBuf,
    source_type: String,
) -> Result<TestData, String> {
    let manager = DataManager::new();
    let source = match source_type.as_str() {
        "csv" => DataSource::Csv(data_path),
        "excel" => DataSource::Excel(data_path),
        "json" => DataSource::Json(data_path),
        _ => return Err("Unsupported data source type".to_string()),
    };

    manager.load_test_data(source).await
        .map_err(|e| format!("Failed to load test data: {}", e))
}

#[command]
pub async fn save_test_data(
    data: TestData,
    output_path: PathBuf,
    format: String,
) -> Result<(), String> {
    let manager = DataManager::new();
    match format.as_str() {
        "csv" => manager.save_as_csv(&data, &output_path).await
            .map_err(|e| UITraceError::Data(e.to_string())),
        "excel" => manager.save_as_excel(&data, &output_path).await
            .map_err(|e| UITraceError::Data(e.to_string())),
        "json" => manager.save_as_json(&data, &output_path).await
            .map_err(|e| UITraceError::Data(e.to_string())),
        _ => Err(UITraceError::Data("Unsupported output format".to_string())),
    }.map_err(|e| format!("Failed to save test data: {}", e))
}

#[command]
pub async fn validate_test_data(data: TestData) -> Result<Value, String> {
    let manager = DataManager::new();
    let validation_result = manager.validate_test_data(&data)
        .map_err(|e| format!("Failed to validate test data: {}", e))?;

    Ok(serde_json::to_value(validation_result).map_err(|e| format!("Failed to serialize validation result: {}", e))?)
}