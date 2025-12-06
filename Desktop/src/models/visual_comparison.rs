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