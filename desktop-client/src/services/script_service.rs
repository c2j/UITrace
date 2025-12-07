use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::path::Path;
use std::fs;

use crate::models::{TestScript, TestStep};
use crate::error::{Result, AppError};

#[derive(Debug, Clone)]
pub struct ScriptService {
    storage_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScriptMetadata {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub author_id: Uuid,
    pub project_id: Option<Uuid>,
    pub tags: Vec<String>,
    pub status: ScriptStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ScriptStatus {
    Draft,
    Active,
    Archived,
    Deprecated,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SerializedScript {
    pub metadata: ScriptMetadata,
    pub steps: Vec<TestStep>,
    pub checksum: String,
}

impl Default for ScriptStatus {
    fn default() -> Self {
        ScriptStatus::Draft
    }
}

impl ScriptService {
    pub fn new(storage_path: String) -> Self {
        // Ensure storage directory exists
        if let Err(e) = fs::create_dir_all(&storage_path) {
            eprintln!("Warning: Could not create storage directory: {}", e);
        }

        Self { storage_path }
    }

    pub fn serialize_script(&self, script: &TestScript, author_id: Uuid,
    ) -> Result<SerializedScript> {
        let script_id = script.id.unwrap_or_else(Uuid::new_v4);
        let now = chrono::Utc::now();

        let metadata = ScriptMetadata {
            id: script_id,
            name: script.name.clone(),
            description: script.description.clone(),
            version: script.version.clone(),
            author_id,
            project_id: script.project_id,
            tags: script.tags.clone(),
            status: ScriptStatus::Draft,
            created_at: now,
            updated_at: now,
        };

        let serialized_script = SerializedScript {
            metadata: metadata.clone(),
            steps: script.steps.clone(),
            checksum: self.calculate_checksum(script)?,
        };

        Ok(serialized_script)
    }

    pub fn deserialize_script(&self, serialized: &SerializedScript,
    ) -> Result<TestScript> {
        // Verify checksum
        let temp_script = TestScript {
            id: Some(serialized.metadata.id),
            name: serialized.metadata.name.clone(),
            description: serialized.metadata.description.clone(),
            version: serialized.metadata.version.clone(),
            author_id: serialized.metadata.author_id,
            project_id: serialized.metadata.project_id,
            tags: serialized.metadata.tags.clone(),
            status: match serialized.metadata.status {
                ScriptStatus::Draft => "draft".to_string(),
                ScriptStatus::Active => "active".to_string(),
                ScriptStatus::Archived => "archived".to_string(),
                ScriptStatus::Deprecated => "deprecated".to_string(),
            },
            steps: serialized.steps.clone(),
            created_at: Some(serialized.metadata.created_at.to_rfc3339()),
            updated_at: Some(serialized.metadata.updated_at.to_rfc3339()),
        };

        let calculated_checksum = self.calculate_checksum(&temp_script)?;
        if calculated_checksum != serialized.checksum {
            return Err(AppError::ScriptError("Checksum mismatch - script may be corrupted".to_string()));
        }

        Ok(temp_script)
    }

    pub fn save_script(&self, serialized: &SerializedScript,
    ) -> Result<()> {
        let file_name = format!("{}.json", serialized.metadata.id);
        let file_path = Path::new(&self.storage_path).join(file_name);

        let json_content = serde_json::to_string_pretty(serialized)
            .map_err(|e| AppError::SerializationError(e))?;

        fs::write(file_path, json_content)
            .map_err(|e| AppError::IoError(e))?;

        Ok(())
    }

    pub fn load_script(&self, script_id: Uuid,
    ) -> Result<SerializedScript> {
        let file_name = format!("{}.json", script_id);
        let file_path = Path::new(&self.storage_path).join(file_name);

        if !file_path.exists() {
            return Err(AppError::ScriptError(format!("Script {} not found", script_id)));
        }

        let json_content = fs::read_to_string(file_path)
            .map_err(|e| AppError::IoError(e))?;

        let serialized: SerializedScript = serde_json::from_str(&json_content)
            .map_err(|e| AppError::SerializationError(e))?;

        Ok(serialized)
    }

    pub fn list_scripts(&self,
    ) -> Result<Vec<ScriptMetadata>> {
        let mut scripts = Vec::new();

        for entry in fs::read_dir(&self.storage_path).map_err(|e| AppError::IoError(e))? {
            let entry = entry.map_err(|e| AppError::IoError(e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(serialized) = serde_json::from_str::<SerializedScript>(&content) {
                        scripts.push(serialized.metadata);
                    }
                }
            }
        }

        // Sort by creation date (newest first)
        scripts.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(scripts)
    }

    pub fn delete_script(&self, script_id: Uuid,
    ) -> Result<()> {
        let file_name = format!("{}.json", script_id);
        let file_path = Path::new(&self.storage_path).join(file_name);

        if !file_path.exists() {
            return Err(AppError::ScriptError(format!("Script {} not found", script_id)));
        }

        fs::remove_file(file_path)
            .map_err(|e| AppError::IoError(e))?;

        Ok(())
    }

    pub fn update_script_status(&self, script_id: Uuid, new_status: ScriptStatus,
    ) -> Result<()> {
        let mut serialized = self.load_script(script_id)?;
        serialized.metadata.status = new_status;
        serialized.metadata.updated_at = chrono::Utc::now();

        // Recalculate checksum
        let temp_script = self.deserialize_script(&serialized)?;
        serialized.checksum = self.calculate_checksum(&temp_script)?;

        self.save_script(&serialized)?;
        Ok(())
    }

    pub fn duplicate_script(&self, script_id: Uuid, new_name: String,
    ) -> Result<Uuid> {
        let original = self.load_script(script_id)?;

        let new_id = Uuid::new_v4();
        let now = chrono::Utc::now();

        let duplicated = SerializedScript {
            metadata: ScriptMetadata {
                id: new_id,
                name: new_name,
                description: original.metadata.description.clone(),
                version: "1.0.0".to_string(),
                author_id: original.metadata.author_id,
                project_id: original.metadata.project_id,
                tags: original.metadata.tags.clone(),
                status: ScriptStatus::Draft,
                created_at: now,
                updated_at: now,
            },
            steps: original.steps.clone(),
            checksum: String::new(), // Will be calculated below
        };

        // Calculate checksum for duplicated script
        let temp_script = self.deserialize_script(&duplicated)?;
        let mut final_duplicated = duplicated;
        final_duplicated.checksum = self.calculate_checksum(&temp_script)?;

        self.save_script(&final_duplicated)?;
        Ok(new_id)
    }

    fn calculate_checksum(&self, script: &TestScript,
    ) -> Result<String> {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        script.name.hash(&mut hasher);
        script.description.hash(&mut hasher);
        script.version.hash(&mut hasher);
        script.steps.len().hash(&mut hasher);

        // Hash each step's critical properties
        for step in &script.steps {
            step.name.hash(&mut hasher);
            // Convert StepAction to string for hashing
            format!("{:?}", step.action).hash(&mut hasher);
            step.value.hash(&mut hasher);
            step.selectors.len().hash(&mut hasher);
        }

        let hash = hasher.finish();
        Ok(format!("{:016x}", hash))
    }

    pub fn validate_script(script: &TestScript) -> Result<()> {
        if script.name.trim().is_empty() {
            return Err(AppError::ScriptError("Script name cannot be empty".to_string()));
        }

        if script.name.len() > 200 {
            return Err(AppError::ScriptError("Script name too long (max 200 characters)".to_string()));
        }

        if let Some(desc) = &script.description {
            if desc.len() > 1000 {
                return Err(AppError::ScriptError("Script description too long (max 1000 characters)".to_string()));
            }
        }

        if script.steps.is_empty() {
            return Err(AppError::ScriptError("Script must have at least one step".to_string()));
        }

        // Validate each step
        for (index, step) in script.steps.iter().enumerate() {
            if step.name.trim().is_empty() {
                return Err(AppError::ScriptError(format!("Step {} name cannot be empty", index + 1)));
            }

            if step.timeout_seconds <= 0 {
                return Err(AppError::ScriptError(format!("Step {} timeout must be positive", index + 1)));
            }

            if step.retry_count < 0 {
                return Err(AppError::ScriptError(format!("Step {} retry count cannot be negative", index + 1)));
            }

            if step.selectors.is_empty() {
                return Err(AppError::ScriptError(format!("Step {} must have at least one selector", index + 1)));
            }
        }

        Ok(())
    }

    pub fn get_script_stats(script: &TestScript) -> ScriptStats {
        let total_steps = script.steps.len();
        let enabled_steps = script.steps.iter().filter(|s| s.enabled).count();
        let total_selectors: usize = script.steps.iter().map(|s| s.selectors.len()).sum();

        let avg_timeout: f64 = if total_steps > 0 {
            script.steps.iter().map(|s| s.timeout_seconds).sum::<i32>() as f64 / total_steps as f64
        } else {
            0.0
        };

        ScriptStats {
            total_steps,
            enabled_steps,
            disabled_steps: total_steps - enabled_steps,
            total_selectors,
            avg_timeout_seconds: avg_timeout,
            has_data_driven_steps: script.steps.iter().any(|s| s.data_source.is_some()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptStats {
    pub total_steps: usize,
    pub enabled_steps: usize,
    pub disabled_steps: usize,
    pub total_selectors: usize,
    pub avg_timeout_seconds: f64,
    pub has_data_driven_steps: bool,
}

impl Default for ScriptService {
    fn default() -> Self {
        Self::new("./scripts".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{StepAction, SelectorType};

    #[test]
    fn test_serialize_deserialize_script() {
        let service = ScriptService::new("./test_scripts".to_string());

        let mut script = TestScript::new("Test Script".to_string(), Uuid::new_v4());
        script.steps.push(TestStep {
            step_id: 1,
            name: "Click login button".to_string(),
            action: StepAction::Click,
            value: None,
            expected_value: None,
            timeout_seconds: 30,
            retry_count: 3,
            selectors: vec![
                Selector {
                    selector_type: SelectorType::Id,
                    value: "#login-btn".to_string(),
                    priority: 1,
                }
            ],
            data_source: None,
            enabled: true,
        });

        let serialized = service.serialize_script(&script, script.author_id).unwrap();
        let deserialized = service.deserialize_script(&serialized).unwrap();

        assert_eq!(deserialized.name, script.name);
        assert_eq!(deserialized.steps.len(), script.steps.len());
        assert_eq!(deserialized.steps[0].name, script.steps[0].name);
    }

    #[test]
    fn test_script_validation() {
        let mut script = TestScript::new("Test".to_string(), Uuid::new_v4());

        // Empty name should fail
        script.name = "".to_string();
        assert!(ScriptService::validate_script(&script).is_err());

        // Restore valid name
        script.name = "Valid Script".to_string();

        // Empty steps should fail
        assert!(ScriptService::validate_script(&script).is_err());

        // Add valid step
        script.steps.push(TestStep {
            step_id: 1,
            name: "Valid step".to_string(),
            action: StepAction::Click,
            value: None,
            expected_value: None,
            timeout_seconds: 30,
            retry_count: 3,
            selectors: vec![
                Selector {
                    selector_type: SelectorType::Id,
                    value: "#test".to_string(),
                    priority: 1,
                }
            ],
            data_source: None,
            enabled: true,
        });

        // Should pass now
        assert!(ScriptService::validate_script(&script).is_ok());
    }

    #[test]
    fn test_script_stats() {
        let mut script = TestScript::new("Test Script".to_string(), Uuid::new_v4());

        script.steps.push(TestStep {
            step_id: 1,
            name: "Step 1".to_string(),
            action: StepAction::Click,
            value: None,
            expected_value: None,
            timeout_seconds: 30,
            retry_count: 3,
            selectors: vec![
                Selector { selector_type: SelectorType::Id, value: "#id1".to_string(), priority: 1 },
                Selector { selector_type: SelectorType::Css, value: ".class1".to_string(), priority: 2 },
            ],
            data_source: None,
            enabled: true,
        });

        script.steps.push(TestStep {
            step_id: 2,
            name: "Step 2".to_string(),
            action: StepAction::Type,
            value: Some("test".to_string()),
            expected_value: None,
            timeout_seconds: 60,
            retry_count: 2,
            selectors: vec![
                Selector { selector_type: SelectorType::Name, value: "[name='test']".to_string(), priority: 1 },
            ],
            data_source: Some("data.csv".to_string()),
            enabled: false,
        });

        let stats = ScriptService::get_script_stats(&script);

        assert_eq!(stats.total_steps, 2);
        assert_eq!(stats.enabled_steps, 1);
        assert_eq!(stats.disabled_steps, 1);
        assert_eq!(stats.total_selectors, 3);
        assert_eq!(stats.avg_timeout_seconds, 45.0);
        assert_eq!(stats.has_data_driven_steps, true);
    }
}

