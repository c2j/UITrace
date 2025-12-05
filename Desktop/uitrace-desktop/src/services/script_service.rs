use std::path::Path;
use std::fs;
use serde_json;
use uuid::Uuid;
use tracing::{info, debug, error};

use crate::models::{TestScript, ApiResponse};
use crate::utils::sanitize_filename;

pub struct ScriptService {
    scripts_directory: String,
}

impl ScriptService {
    pub fn new(scripts_dir: String) -> Self {
        Self {
            scripts_directory: scripts_dir,
        }
    }

    pub fn save_script(&self, script: &TestScript) -> Result<String, String> {
        info!("Saving script: {} ({})", script.name, script.id);

        // Ensure scripts directory exists
        if let Err(e) = fs::create_dir_all(&self.scripts_directory) {
            return Err(format!("Failed to create scripts directory: {}", e));
        }

        let filename = format!("{}.json", script.id);
        let filepath = Path::new(&self.scripts_directory).join(&filename);

        match serde_json::to_string_pretty(script) {
            Ok(json_content) => {
                match fs::write(&filepath, json_content) {
                    Ok(_) => {
                        info!("Script saved successfully: {:?}", filepath);
                        Ok(script.id.to_string())
                    }
                    Err(e) => {
                        error!("Failed to write script file: {}", e);
                        Err(format!("Failed to save script: {}", e))
                    }
                }
            }
            Err(e) => {
                error!("Failed to serialize script: {}", e);
                Err(format!("Failed to serialize script: {}", e))
            }
        }
    }

    pub fn load_script(&self, script_id: &str) -> Result<TestScript, String> {
        info!("Loading script: {}", script_id);

        let filename = format!("{}.json", script_id);
        let filepath = Path::new(&self.scripts_directory).join(&filename);

        if !filepath.exists() {
            return Err(format!("Script not found: {}", script_id));
        }

        match fs::read_to_string(&filepath) {
            Ok(json_content) => {
                match serde_json::from_str::<TestScript>(&json_content) {
                    Ok(script) => {
                        info!("Script loaded successfully: {}", script_id);
                        Ok(script)
                    }
                    Err(e) => {
                        error!("Failed to deserialize script: {}", e);
                        Err(format!("Failed to load script: {}", e))
                    }
                }
            }
            Err(e) => {
                error!("Failed to read script file: {}", e);
                Err(format!("Failed to read script file: {}", e))
            }
        }
    }

    pub fn list_scripts(&self) -> Result<Vec<TestScript>, String> {
        info!("Listing all scripts");

        let mut scripts = Vec::new();

        if !Path::new(&self.scripts_directory).exists() {
            return Ok(scripts);
        }

        match fs::read_dir(&self.scripts_directory) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.extension().and_then(|s| s.to_str()) == Some("json") {
                            if let Ok(content) = fs::read_to_string(&path) {
                                if let Ok(script) = serde_json::from_str::<TestScript>(&content) {
                                    scripts.push(script);
                                } else {
                                    error!("Failed to parse script file: {:?}", path);
                                }
                            }
                        }
                    }
                }

                info!("Found {} scripts", scripts.len());
                Ok(scripts)
            }
            Err(e) => {
                error!("Failed to read scripts directory: {}", e);
                Err(format!("Failed to list scripts: {}", e))
            }
        }
    }

    pub fn delete_script(&self, script_id: &str) -> Result<(), String> {
        info!("Deleting script: {}", script_id);

        let filename = format!("{}.json", script_id);
        let filepath = Path::new(&self.scripts_directory).join(&filename);

        if !filepath.exists() {
            return Err(format!("Script not found: {}", script_id));
        }

        match fs::remove_file(&filepath) {
            Ok(_) => {
                info!("Script deleted successfully: {}", script_id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to delete script file: {}", e);
                Err(format!("Failed to delete script: {}", e))
            }
        }
    }

    pub fn script_exists(&self, script_id: &str) -> bool {
        let filename = format!("{}.json", script_id);
        let filepath = Path::new(&self.scripts_directory).join(&filename);
        filepath.exists()
    }

    pub fn create_script_backup(&self, script_id: &str) -> Result<String, String> {
        info!("Creating backup for script: {}", script_id);

        let script = self.load_script(script_id)?;
        let backup_filename = format!("{}_backup_{}.json", script_id, chrono::Utc::now().format("%Y%m%d_%H%M%S"));
        let backup_filepath = Path::new(&self.scripts_directory).join(&backup_filename);

        match serde_json::to_string_pretty(&script) {
            Ok(json_content) => {
                match fs::write(&backup_filepath, json_content) {
                    Ok(_) => {
                        info!("Backup created successfully: {:?}", backup_filepath);
                        Ok(backup_filename)
                    }
                    Err(e) => {
                        error!("Failed to create backup: {}", e);
                        Err(format!("Failed to create backup: {}", e))
                    }
                }
            }
            Err(e) => {
                error!("Failed to serialize script for backup: {}", e);
                Err(format!("Failed to serialize script: {}", e))
            }
        }
    }

    pub fn get_script_statistics(&self) -> Result<ScriptStatistics, String> {
        let scripts = self.list_scripts()?;

        let total_scripts = scripts.len();
        let total_steps: usize = scripts.iter().map(|s| s.steps.len()).sum();
        let average_steps = if total_scripts > 0 {
            total_steps as f64 / total_scripts as f64
        } else {
            0.0
        };

        Ok(ScriptStatistics {
            total_scripts,
            total_steps,
            average_steps_per_script: average_steps,
        })
    }
}

#[derive(Debug, Clone)]
pub struct ScriptStatistics {
    pub total_scripts: usize,
    pub total_steps: usize,
    pub average_steps_per_script: f64,
}

impl Default for ScriptService {
    fn default() -> Self {
        Self::new("storage/scripts".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_script_service_creation() {
        let temp_dir = TempDir::new().unwrap();
        let service = ScriptService::new(temp_dir.path().to_string_lossy().to_string());

        // Test that service can be created
        assert_eq!(service.scripts_directory, temp_dir.path().to_string_lossy().to_string());
    }

    #[test]
    fn test_save_and_load_script() {
        let temp_dir = TempDir::new().unwrap();
        let service = ScriptService::new(temp_dir.path().to_string_lossy().to_string());

        let mut script = TestScript::new("Test Script".to_string(), Some("A test script".to_string()));

        // Save script
        let result = service.save_script(&script);
        assert!(result.is_ok());

        // Load script
        let loaded_script = service.load_script(&script.id.to_string());
        assert!(loaded_script.is_ok());

        let loaded = loaded_script.unwrap();
        assert_eq!(loaded.name, script.name);
        assert_eq!(loaded.description, script.description);
    }
}