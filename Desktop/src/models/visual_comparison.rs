use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualDiffResult {
    pub images_compared: ImagesCompared,
    pub metrics: ComparisonMetrics,
    pub diff_image: Option<PathBuf>,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImagesCompared {
    pub baseline: PathBuf,
    pub current: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonMetrics {
    pub similarity_percentage: f32,
    pub pixel_difference_count: u32,
    pub total_pixels: u32,
    pub diff_regions: Vec<DiffRegion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub intensity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaselineImage {
    pub name: String,
    pub path: PathBuf,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub description: Option<String>,
    pub tags: Vec<String>,
}

// Add VisualBaseline struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualBaseline {
    pub id: String,
    pub script_id: String,
    pub step_id: String,
    pub browser_type: Option<String>,
    pub viewport_width: Option<u32>,
    pub viewport_height: Option<u32>,
    pub baseline_path: String,
    pub similarity_threshold: f32,
    pub is_active: bool,
    pub created_by: String,
    pub created_at: String,
    // Add missing fields for baseline_management.rs compatibility
    pub path: Option<String>,
    pub hash: Option<String>,
    pub threshold: Option<f32>,
}

impl VisualBaseline {
    pub fn new(
        script_id: String,
        step_id: String,
        baseline_path: String,
        created_by: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            script_id,
            step_id,
            browser_type: None,
            viewport_width: None,
            viewport_height: None,
            baseline_path: baseline_path.clone(),
            similarity_threshold: 0.95,
            is_active: true,
            created_by,
            created_at: chrono::Utc::now().to_rfc3339(),
            path: Some(baseline_path),
            hash: None,
            threshold: Some(0.95),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonConfig {
    pub threshold: f32,
    pub ignore_regions: Vec<IgnoreRegion>,
    pub comparison_mode: ComparisonMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgnoreRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComparisonMode {
    Exact,
    Similar,
    IgnoreColors,
    IgnoreAntialiasing,
}

impl Default for ComparisonConfig {
    fn default() -> Self {
        Self {
            threshold: 0.99,
            ignore_regions: Vec::new(),
            comparison_mode: ComparisonMode::Exact,
        }
    }
}