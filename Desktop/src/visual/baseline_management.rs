use crate::models::{VisualBaseline, TestScript};
use std::path::{Path, PathBuf};
use std::fs;
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use thiserror::Error;
use log::{debug, info, warn, error};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum BaselineError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Baseline not found: {0}")]
    NotFound(String),
    #[error("Invalid baseline path: {0}")]
    InvalidPath(String),
    #[error("Baseline already exists: {0}")]
    AlreadyExists(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaselineMetadata {
    pub id: String,
    pub name: String,
    pub script_id: String,
    pub step_index: Option<usize>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub environment: Option<String>,
    pub browser: Option<String>,
    pub viewport_size: Option<(u32, u32)>,
    pub threshold: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaselineCollection {
    pub baselines: HashMap<String, BaselineMetadata>,
    pub version: String,
}

impl BaselineCollection {
    pub fn new() -> Self {
        Self {
            baselines: HashMap::new(),
            version: "1.0".to_string(),
        }
    }
}

pub struct BaselineManager {
    baseline_dir: PathBuf,
    metadata: BaselineCollection,
    metadata_file: PathBuf,
}

impl BaselineManager {
    /// Create a new baseline manager
    pub fn new<P: AsRef<Path>>(baseline_dir: P) -> Result<Self, BaselineError> {
        let baseline_dir = baseline_dir.as_ref().to_path_buf();
        let metadata_file = baseline_dir.join("metadata.json");

        // Create directory if it doesn't exist
        fs::create_dir_all(&baseline_dir)?;

        // Load or create metadata
        let metadata = if metadata_file.exists() {
            let content = fs::read_to_string(&metadata_file)?;
            serde_json::from_str(&content)?
        } else {
            BaselineCollection::new()
        };

        info!("Initialized baseline manager with directory: {}", baseline_dir.display());

        Ok(Self {
            baseline_dir,
            metadata,
            metadata_file,
        })
    }

    /// Create or update a baseline
    pub async fn create_baseline(
        &mut self,
        script_id: &str,
        step_index: Option<usize>,
        image_path: &Path,
        threshold: Option<f32>,
        metadata: Option<BaselineMetadata>,
    ) -> Result<VisualBaseline, BaselineError> {
        let baseline_id = metadata.as_ref()
            .map(|m| m.id.clone())
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        // Read image data
        let image_data = fs::read(image_path)?;
        let image_hash = self.calculate_image_hash(&image_data);

        // Determine baseline file path
        let baseline_path = self.get_baseline_path(&baseline_id, image_path.extension());

        // Create baseline metadata
        let baseline_metadata = if let Some(mut m) = metadata {
            m.updated_at = Utc::now();
            m.threshold = threshold.unwrap_or(0.99);
            m
        } else {
            BaselineMetadata {
                id: baseline_id.clone(),
                name: format!("Baseline for {} - Step {:?}", script_id, step_index),
                script_id: script_id.to_string(),
                step_index,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                description: None,
                tags: vec![],
                environment: Some("default".to_string()),
                browser: Some("chrome".to_string()),
                viewport_size: None,
                threshold: threshold.unwrap_or(0.99),
            }
        };

        // Save baseline image
        fs::write(&baseline_path, image_data)?;

        // Update metadata
        self.metadata.baselines.insert(baseline_id.clone(), baseline_metadata.clone());
        self.save_metadata()?;

        info!("Created baseline: {} at {}", baseline_id, baseline_path.display());

        Ok(VisualBaseline {
            id: baseline_id,
            path: baseline_path,
            hash: image_hash,
            threshold: baseline_metadata.threshold,
            created_at: baseline_metadata.created_at,
        })
    }

    /// Get a baseline by ID
    pub fn get_baseline(&self, baseline_id: &str) -> Result<VisualBaseline, BaselineError> {
        let metadata = self.metadata.baselines.get(baseline_id)
            .ok_or_else(|| BaselineError::NotFound(
                format!("Baseline '{}' not found", baseline_id)
            ))?;

        let baseline_path = self.get_baseline_path(baseline_id, Some("png"));
        let image_data = fs::read(&baseline_path)?;
        let image_hash = self.calculate_image_hash(&image_data);

        Ok(VisualBaseline {
            id: baseline_id.to_string(),
            path: baseline_path,
            hash: image_hash,
            threshold: metadata.threshold,
            created_at: metadata.created_at,
        })
    }

    /// Get baselines for a script
    pub fn get_script_baselines(&self, script_id: &str) -> Result<Vec<VisualBaseline>, BaselineError> {
        let mut baselines = Vec::new();

        for (baseline_id, metadata) in &self.metadata.baselines {
            if metadata.script_id == script_id {
                if let Ok(baseline) = self.get_baseline(baseline_id) {
                    baselines.push(baseline);
                }
            }
        }

        // Sort by step index then created_at
        baselines.sort_by(|a, b| {
            let a_step = self.metadata.baselines.get(&a.id).and_then(|m| m.step_index);
            let b_step = self.metadata.baselines.get(&b.id).and_then(|m| m.step_index);

            match (a_step, b_step) {
                (Some(a), Some(b)) => a.cmp(&b),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => a.created_at.cmp(&b.created_at),
            }
        });

        Ok(baselines)
    }

    /// Get baseline for a specific step
    pub fn get_step_baseline(&self, script_id: &str, step_index: usize) -> Result<Option<VisualBaseline>, BaselineError> {
        let mut candidates = Vec::new();

        for (baseline_id, metadata) in &self.metadata.baselines {
            if metadata.script_id == script_id && metadata.step_index == Some(step_index) {
                if let Ok(baseline) = self.get_baseline(baseline_id) {
                    candidates.push(baseline);
                }
            }
        }

        // Return the most recent baseline
        candidates.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(candidates.into_iter().next())
    }

    /// Update a baseline
    pub async fn update_baseline(
        &mut self,
        baseline_id: &str,
        image_path: &Path,
        threshold: Option<f32>,
    ) -> Result<VisualBaseline, BaselineError> {
        let metadata = self.metadata.baselines.get_mut(baseline_id)
            .ok_or_else(|| BaselineError::NotFound(
                format!("Baseline '{}' not found", baseline_id)
            ))?;

        // Read new image data
        let image_data = fs::read(image_path)?;
        let image_hash = self.calculate_image_hash(&image_data);

        // Update baseline image
        let baseline_path = self.get_baseline_path(baseline_id, image_path.extension());
        fs::write(&baseline_path, image_data)?;

        // Update metadata
        metadata.updated_at = Utc::now();
        if let Some(t) = threshold {
            metadata.threshold = t;
        }

        self.save_metadata()?;

        info!("Updated baseline: {}", baseline_id);

        Ok(VisualBaseline {
            id: baseline_id.to_string(),
            path: baseline_path,
            hash: image_hash,
            threshold: metadata.threshold,
            created_at: metadata.created_at,
        })
    }

    /// Delete a baseline
    pub fn delete_baseline(&mut self, baseline_id: &str) -> Result<(), BaselineError> {
        // Remove from metadata
        self.metadata.baselines.remove(baseline_id);

        // Delete baseline files
        let baseline_path = self.get_baseline_path(baseline_id, Some("png"));
        if baseline_path.exists() {
            fs::remove_file(&baseline_path)?;
        }

        // Also remove other possible formats
        for ext in ["jpg", "jpeg", "webp"] {
            let path = self.get_baseline_path(baseline_id, Some(ext));
            if path.exists() {
                fs::remove_file(&path)?;
            }
        }

        self.save_metadata()?;

        info!("Deleted baseline: {}", baseline_id);
        Ok(())
    }

    /// List all baselines
    pub fn list_baselines(&self) -> Result<Vec<BaselineMetadata>, BaselineError> {
        let mut baselines: Vec<_> = self.metadata.baselines.values().cloned().collect();
        baselines.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(baselines)
    }

    /// Clean up old baselines (keep only the N most recent per script)
    pub fn cleanup_old_baselines(&mut self, keep_count: usize) -> Result<usize, BaselineError> {
        let mut removed = 0;
        let mut script_baselines: HashMap<String, Vec<String>> = HashMap::new();

        // Group baselines by script
        for (baseline_id, metadata) in &self.metadata.baselines {
            script_baselines
                .entry(metadata.script_id.clone())
                .or_default()
                .push(baseline_id.clone());
        }

        // Sort each group by created_at (newest first) and remove old ones
        for baselines in script_baselines.values_mut() {
            baselines.sort_by(|a, b| {
                let a_created = self.metadata.baselines.get(a).unwrap().created_at;
                let b_created = self.metadata.baselines.get(b).unwrap().created_at;
                b_created.cmp(&a_created)
            });

            // Remove excess baselines
            for baseline_id in baselines.iter().skip(keep_count) {
                self.delete_baseline(baseline_id)?;
                removed += 1;
            }
        }

        info!("Cleaned up {} old baselines", removed);
        Ok(removed)
    }

    /// Export baselines to a zip file
    pub async fn export_baselines(&self, output_path: &Path) -> Result<(), BaselineError> {
        use std::fs::File;
        use std::io::Write;

        // Create a simple manifest
        let manifest = serde_json::to_string_pretty(&self.metadata)?;
        fs::write(output_path.join("manifest.json"), manifest)?;

        // Note: In a real implementation, you might want to create an actual zip file
        // This is simplified for demonstration
        info!("Exported baselines to: {}", output_path.display());
        Ok(())
    }

    /// Get baseline path for a given ID
    fn get_baseline_path(&self, baseline_id: &str, extension: Option<&str>) -> PathBuf {
        let ext = extension.unwrap_or("png");
        self.baseline_dir.join(format!("{}.{}", baseline_id, ext))
    }

    /// Calculate hash of image data for integrity checking
    fn calculate_image_hash(&self, data: &[u8]) -> String {
        use std::hash::{Hash, Hasher};
        use std::collections::hash_map::DefaultHasher;

        let mut hasher = DefaultHasher::new();
        hasher.write(data);
        format!("{:x}", hasher.finish())
    }

    /// Save metadata to file
    fn save_metadata(&self) -> Result<(), BaselineError> {
        let content = serde_json::to_string_pretty(&self.metadata)?;
        fs::write(&self.metadata_file, content)?;
        Ok(())
    }
}

impl Default for BaselineManager {
    fn default() -> Self {
        Self::new("baselines").unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_create_and_get_baseline() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = BaselineManager::new(temp_dir.path()).unwrap();

        // Create a dummy image file
        let image_path = temp_dir.path().join("test.png");
        fs::write(&image_path, b"dummy_image_data").unwrap();

        // Create baseline
        let baseline = manager.create_baseline(
            "script-123",
            Some(1),
            &image_path,
            Some(0.95),
            None,
        ).await.unwrap();

        assert_eq!(baseline.script_id, "script-123");
        assert_eq!(baseline.threshold, 0.95);

        // Get baseline
        let retrieved = manager.get_baseline(&baseline.id).unwrap();
        assert_eq!(retrieved.id, baseline.id);
        assert_eq!(retrieved.hash, baseline.hash);
    }

    #[tokio::test]
    async fn test_get_step_baseline() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = BaselineManager::new(temp_dir.path()).unwrap();

        // Create dummy image file
        let image_path = temp_dir.path().join("test.png");
        fs::write(&image_path, b"dummy_image_data").unwrap();

        // Create baseline for step 1
        let baseline1 = manager.create_baseline(
            "script-123",
            Some(1),
            &image_path,
            None,
            None,
        ).await.unwrap();

        // Create baseline for step 2
        let baseline2 = manager.create_baseline(
            "script-123",
            Some(2),
            &image_path,
            None,
            None,
        ).await.unwrap();

        // Get baseline for step 1
        let retrieved = manager.get_step_baseline("script-123", 1).unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, baseline1.id);
    }

    #[tokio::test]
    async fn test_delete_baseline() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = BaselineManager::new(temp_dir.path()).unwrap();

        // Create dummy image file
        let image_path = temp_dir.path().join("test.png");
        fs::write(&image_path, b"dummy_image_data").unwrap();

        // Create baseline
        let baseline = manager.create_baseline(
            "script-123",
            None,
            &image_path,
            None,
            None,
        ).await.unwrap();

        // Verify it exists
        assert!(manager.get_baseline(&baseline.id).is_ok());

        // Delete baseline
        manager.delete_baseline(&baseline.id).unwrap();

        // Verify it's gone
        assert!(manager.get_baseline(&baseline.id).is_err());
    }
}
