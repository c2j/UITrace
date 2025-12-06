use crate::models::TestScript;
use crate::models::test_step::TestStep;
use std::path::PathBuf;
use std::fs;
use std::io;
use serde_json;
use thiserror::Error;
use chrono::Utc;

#[derive(Error, Debug)]
pub enum ScriptServiceError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Script not found: {0}")]
    NotFound(String),
    #[error("Invalid script format: {0}")]
    InvalidFormat(String),
}

pub struct ScriptService {
    script_directory: PathBuf,
}

impl ScriptService {
    pub fn new(script_directory: PathBuf) -> Self {
        Self {
            script_directory,
        }
    }

    /// Create the script directory if it doesn't exist
    pub fn ensure_directory(&self) -> Result<(), ScriptServiceError> {
        if !self.script_directory.exists() {
            fs::create_dir_all(&self.script_directory)?;
        }
        Ok(())
    }

    /// Save a script to disk
    pub fn save_script(&self, script: &mut TestScript) -> Result<(), ScriptServiceError> {
        self.ensure_directory()?;

        // Update timestamps
        script.updated_at = Utc::now().to_rfc3339();

        let file_path = self.script_directory.join(format!("{}.json", script.id));
        let json = script.to_json()?;
        fs::write(file_path, json)?;

        Ok(())
    }

    /// Load a script by ID
    pub fn load_script(&self, id: &str) -> Result<TestScript, ScriptServiceError> {
        let file_path = self.script_directory.join(format!("{}.json", id));

        if !file_path.exists() {
            return Err(ScriptServiceError::NotFound(id.to_string()));
        }

        let content = fs::read_to_string(file_path)?;
        let script = TestScript::from_json(&content)?;

        Ok(script)
    }

    /// Load all scripts from the directory
    pub fn load_all_scripts(&self) -> Result<Vec<TestScript>, ScriptServiceError> {
        self.ensure_directory()?;

        let mut scripts = Vec::new();

        if let Ok(entries) = fs::read_dir(&self.script_directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(script) = TestScript::from_json(&content) {
                            scripts.push(script);
                        }
                    }
                }
            }
        }

        // Sort by updated_at descending
        scripts.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(scripts)
    }

    /// Delete a script by ID
    pub fn delete_script(&self, id: &str) -> Result<(), ScriptServiceError> {
        let file_path = self.script_directory.join(format!("{}.json", id));

        if file_path.exists() {
            fs::remove_file(file_path)?;
        }

        Ok(())
    }

    /// Import a script from a file path
    pub fn import_script(&self, file_path: &PathBuf) -> Result<TestScript, ScriptServiceError> {
        let content = fs::read_to_string(file_path)?;
        let mut script = TestScript::from_json(&content)?;

        // Generate new ID to avoid conflicts
        script.id = uuid::Uuid::new_v4().to_string();
        script.created_at = Utc::now().to_rfc3339();
        script.updated_at = script.created_at.clone();

        Ok(script)
    }

    /// Export a script to a file path
    pub fn export_script(&self, id: &str, export_path: &PathBuf) -> Result<(), ScriptServiceError> {
        let script = self.load_script(id)?;
        let json = script.to_json()?;
        fs::write(export_path, json)?;
        Ok(())
    }

    /// Validate script structure
    pub fn validate_script(&self, script: &TestScript) -> Result<(), ScriptServiceError> {
        // Check required fields
        if script.name.is_empty() {
            return Err(ScriptServiceError::InvalidFormat("Script name cannot be empty".to_string()));
        }

        if script.created_by.is_empty() {
            return Err(ScriptServiceError::InvalidFormat("Script created_by cannot be empty".to_string()));
        }

        // Validate steps
        for (index, step) in script.steps.iter().enumerate() {
            if step.action.is_empty() {
                return Err(ScriptServiceError::InvalidFormat(
                    format!("Step {} has empty action", index + 1)
                ));
            }

            // Validate selectors
            if step.selectors.is_empty() && !matches!(step.action.as_str(), "navigate" | "wait" | "screenshot") {
                return Err(ScriptServiceError::InvalidFormat(
                    format!("Step {} requires at least one selector", index + 1)
                ));
            }
        }

        Ok(())
    }

    /// Duplicate a script with a new name
    pub fn duplicate_script(&self, id: &str, new_name: &str) -> Result<TestScript, ScriptServiceError> {
        let mut script = self.load_script(id)?;
        script.id = uuid::Uuid::new_v4().to_string();
        script.name = new_name.to_string();
        script.created_at = Utc::now().to_rfc3339();
        script.updated_at = script.created_at.clone();

        self.save_script(&mut script)?;
        Ok(script)
    }

    /// Search scripts by name, description, or tags
    pub fn search_scripts(&self, query: &str) -> Result<Vec<TestScript>, ScriptServiceError> {
        let scripts = self.load_all_scripts()?;
        let query = query.to_lowercase();

        let filtered: Vec<TestScript> = scripts
            .into_iter()
            .filter(|script| {
                script.name.to_lowercase().contains(&query)
                    || script.description.as_ref().map_or(false, |d| d.to_lowercase().contains(&query))
                    || script.tags.iter().any(|tag| tag.to_lowercase().contains(&query))
            })
            .collect();

        Ok(filtered)
    }
}

impl Default for ScriptService {
    fn default() -> Self {
        Self::new(
            std::env::current_dir()
                .unwrap_or_default()
                .join("scripts")
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use crate::models::selector::Selector;

    #[test]
    fn test_save_and_load_script() {
        let temp_dir = TempDir::new().unwrap();
        let service = ScriptService::new(temp_dir.path().to_path_buf());

        let mut script = TestScript::new(
            "Test Script".to_string(),
            "test@example.com".to_string()
        );

        service.save_script(&mut script).unwrap();

        let loaded = service.load_script(&script.id).unwrap();
        assert_eq!(loaded.name, script.name);
        assert_eq!(loaded.created_by, script.created_by);
    }

    #[test]
    fn test_load_nonexistent_script() {
        let temp_dir = TempDir::new().unwrap();
        let service = ScriptService::new(temp_dir.path().to_path_buf());

        let result = service.load_script("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_script() {
        let temp_dir = TempDir::new().unwrap();
        let service = ScriptService::new(temp_dir.path().to_path_buf());

        let mut script = TestScript::new(
            "Test Script".to_string(),
            "test@example.com".to_string()
        );

        service.save_script(&mut script).unwrap();
        service.delete_script(&script.id).unwrap();

        let result = service.load_script(&script.id);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_empty_script() {
        let temp_dir = TempDir::new().unwrap();
        let service = ScriptService::new(temp_dir.path().to_path_buf());

        let script = TestScript::new(
            "".to_string(), // Empty name
            "test@example.com".to_string()
        );

        let result = service.validate_script(&script);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_step_without_selector() {
        let temp_dir = TempDir::new().unwrap();
        let service = ScriptService::new(temp_dir.path().to_path_buf());

        let step = TestStep::new(
            1,
            "Click button".to_string(),
            "click".to_string()
        );

        let script = TestScript::new(
            "Test Script".to_string(),
            "test@example.com".to_string()
        ).add_step(step);

        let result = service.validate_script(&script);
        assert!(result.is_err());
    }

    #[test]
    fn test_search_scripts() {
        let temp_dir = TempDir::new().unwrap();
        let service = ScriptService::new(temp_dir.path().to_path_buf());

        // Create test scripts
        let mut script1 = TestScript::new(
            "Login Test".to_string(),
            "test@example.com".to_string()
        ).add_tag("authentication".to_string());

        let mut script2 = TestScript::new(
            "Search Test".to_string(),
            "test@example.com".to_string()
        ).add_tag("search".to_string());

        service.save_script(&mut script1).unwrap();
        service.save_script(&mut script2).unwrap();

        // Search by name
        let results = service.search_scripts("login").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Login Test");

        // Search by tag
        let results = service.search_scripts("search").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Search Test");
    }
}
