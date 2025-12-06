use crate::visual::{VisualComparator, ScreenshotConfig};
use serde_json::Value;
use std::path::PathBuf;
use tauri::command;

#[command]
pub async fn take_screenshot(
    url: String,
    save_path: PathBuf,
    config: Option<ScreenshotConfig>,
) -> Result<String, String> {
    let mut comparator = VisualComparator::new();
    let screenshot_path = comparator.take_screenshot(&url, &save_path, config).await
        .map_err(|e| format!("Failed to take screenshot: {}", e))?;

    Ok(screenshot_path.to_string_lossy().to_string())
}

#[command]
pub async fn compare_images(
    image1_path: PathBuf,
    image2_path: PathBuf,
    output_path: Option<PathBuf>,
    threshold: Option<f32>,
) -> Result<Value, String> {
    let comparator = VisualComparator::new();
    let result = comparator.compare_images(&image1_path, &image2_path, output_path, threshold).await
        .map_err(|e| format!("Failed to compare images: {}", e))?;

    Ok(serde_json::to_value(result).map_err(|e| format!("Failed to serialize result: {}", e))?)
}

#[command]
pub async fn generate_diff_report(
    image1_path: PathBuf,
    image2_path: PathBuf,
    report_path: PathBuf,
) -> Result<(), String> {
    let comparator = VisualComparator::new();
    comparator.generate_diff_report(&image1_path, &image2_path, &report_path).await
        .map_err(|e| format!("Failed to generate diff report: {}", e))
}