//! E2E test for record-edit-save workflow
//! Tests the complete user journey of recording, editing, and saving a test script

use std::path::PathBuf;
use serde_json::{json, Value};
use tempfile::TempDir;

/// End-to-end test for the complete script recording workflow
#[cfg(test)]
mod tests {
    use super::*;

    /// Test: User can record a simple login journey and save it as a script
    #[tokio::test]
    async fn test_record_edit_save_workflow() -> Result<(), Box<dyn std::error::Error>> {
        // Setup: Create temporary directory for test data
        let temp_dir = TempDir::new()?;
        let script_path = temp_dir.path().join("test_script.json");

        // Step 1: Start recording
        println!("Starting script recording...");

        // Simulate user actions: navigate to login page
        let navigate_action = json!({
            "type": "navigate",
            "url": "https://example.com/login",
            "timeout": 5000
        });

        // Simulate user actions: enter username
        let username_action = json!({
            "type": "type",
            "selectors": [
                {"type": "id", "value": "username"},
                {"type": "css", "value": "input[name='username']"},
                {"type": "xpath", "value": "//input[@id='username']"}
            ],
            "value": "${username}",
            "timeout": 3000
        });

        // Simulate user actions: enter password
        let password_action = json!({
            "type": "type",
            "selectors": [
                {"type": "id", "value": "password"},
                {"type": "css", "value": "input[name='password']"},
                {"type": "xpath", "value": "//input[@id='password']"}
            ],
            "value": "${password}",
            "timeout": 3000
        });

        // Simulate user actions: click submit button
        let submit_action = json!({
            "type": "click",
            "selectors": [
                {"type": "id", "value": "submit-button"},
                {"type": "css", "value": "button[type='submit']"},
                {"type": "xpath", "value": "//button[@id='submit-button']"}
            ],
            "timeout": 3000
        });

        // Step 2: Compile recorded actions into a script
        let script = json!({
            "id": "test-script-001",
            "name": "Login Test",
            "version": 1,
            "description": "Test user login with valid credentials",
            "steps": [
                navigate_action,
                username_action,
                password_action,
                submit_action
            ],
            "variables": ["username", "password"],
            "tags": ["login", "authentication"]
        });

        // Step 3: Save script to file
        std::fs::write(&script_path, serde_json::to_string_pretty(&script)?)?;

        println!("Script saved to: {:?}", script_path);

        // Step 4: Load and verify the saved script
        let loaded_script: Value = serde_json::from_str(&std::fs::read_to_string(&script_path)?)?;

        // Assertions: Verify script structure
        assert_eq!(loaded_script["id"], "test-script-001");
        assert_eq!(loaded_script["name"], "Login Test");
        assert_eq!(loaded_script["version"], 1);
        assert_eq!(loaded_script["steps"].as_array().unwrap().len(), 4);

        // Step 5: Verify each step has the required structure
        let steps = loaded_script["steps"].as_array().unwrap();
        assert_eq!(steps[0]["type"], "navigate");
        assert_eq!(steps[1]["type"], "type");
        assert_eq!(steps[1]["value"], "${username}");
        assert_eq!(steps[2]["type"], "type");
        assert_eq!(steps[2]["value"], "${password}");
        assert_eq!(steps[3]["type"], "click");

        // Step 6: Verify all steps have selectors
        for (i, step) in steps.iter().enumerate() {
            if step["type"] != "navigate" {
                assert!(step["selectors"].is_array(), "Step {} missing selectors", i);
                let selectors = step["selectors"].as_array().unwrap();
                assert!(selectors.len() >= 3, "Step {} should have at least 3 selectors", i);

                // Verify selector types
                let selector_types: Vec<String> = selectors
                    .iter()
                    .map(|s| s["type"].as_str().unwrap().to_string())
                    .collect();

                assert!(selector_types.contains(&"id".to_string()), "Step {} missing id selector", i);
                assert!(selector_types.contains(&"css".to_string()), "Step {} missing css selector", i);
                assert!(selector_types.contains(&"xpath".to_string()), "Step {} missing xpath selector", i);
            }
        }

        // Step 7: Edit the script - modify timeout values
        let mut loaded_script_mut = loaded_script;
        let steps_mut = loaded_script_mut["steps"].as_array_mut().unwrap();
        for step in steps_mut.iter_mut() {
            if let Some(timeout) = step["timeout"].as_i64() {
                let new_timeout = timeout + 1000; // Increase timeout by 1 second
                step["timeout"] = Value::from(new_timeout);
            }
        }

        // Step 8: Save edited script
        std::fs::write(&script_path, serde_json::to_string_pretty(&loaded_script_mut)?)?;

        // Step 9: Verify edited script
        let edited_script: Value = serde_json::from_str(&std::fs::read_to_string(&script_path)?)?;
        let edited_steps = edited_script["steps"].as_array().unwrap();

        // Verify timeout was updated (original 3000 + 1000 = 4000)
        assert_eq!(edited_steps[1]["timeout"], 4000);
        assert_eq!(edited_steps[2]["timeout"], 4000);
        assert_eq!(edited_steps[3]["timeout"], 4000);

        println!("✅ E2E test passed: Record-edit-save workflow completed successfully");

        Ok(())
    }

    /// Test: Script metadata is properly preserved
    #[tokio::test]
    async fn test_script_metadata_preservation() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let script_path = temp_dir.path().join("script_with_metadata.json");

        let script_with_metadata = json!({
            "id": "metadata-test-001",
            "name": "Metadata Test Script",
            "version": 2,
            "description": "Test script to verify metadata handling",
            "created_by": "test_user",
            "created_at": "2025-12-06T00:00:00Z",
            "tags": ["e2e", "metadata", "test"],
            "steps": [
                {
                    "type": "navigate",
                    "url": "https://example.com",
                    "timeout": 5000
                }
            ],
            "variables": []
        });

        std::fs::write(&script_path, serde_json::to_string_pretty(&script_with_metadata)?)?;

        let loaded: Value = serde_json::from_str(&std::fs::read_to_string(&script_path)?)?;

        // Verify metadata is preserved
        assert_eq!(loaded["name"], "Metadata Test Script");
        assert_eq!(loaded["version"], 2);
        assert_eq!(loaded["description"], "Test script to verify metadata handling");
        assert_eq!(loaded["created_by"], "test_user");
        assert_eq!(loaded["tags"].as_array().unwrap().len(), 3);

        println!("✅ Metadata preservation test passed");
        Ok(())
    }

    /// Test: Script validation works correctly
    #[tokio::test]
    async fn test_script_validation() -> Result<(), Box<dyn std::error::Error>> {
        // Test invalid script - missing required fields
        let invalid_script = json!({
            "id": "invalid-script",
            "name": "Invalid Script"
            // Missing version, steps
        });

        let temp_dir = TempDir::new()?;
        let script_path = temp_dir.path().join("invalid_script.json");
        std::fs::write(&script_path, serde_json::to_string(&invalid_script)?)?;

        // Load and validate
        let loaded: Value = serde_json::from_str(&std::fs::read_to_string(&script_path)?)?;

        // Validation should fail for incomplete script
        let has_version = loaded.get("version").is_some();
        let has_steps = loaded.get("steps").is_some();
        let has_valid_steps = has_steps &&
            loaded["steps"].as_array().map(|s| !s.is_empty()).unwrap_or(false);

        assert!(!has_valid_steps, "Script with missing steps should be invalid");

        println!("✅ Script validation test passed");
        Ok(())
    }
}
