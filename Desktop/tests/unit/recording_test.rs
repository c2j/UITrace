#[cfg(test)]
mod tests {
    use uitrace_desktop::models::TestScript;
    use uitrace_desktop::services::script_service::{ScriptService, ScriptServiceError};
    use std::path::PathBuf;
    use tempfile::TempDir;
    use serde_json;

    #[tokio::test]
    async fn test_user_story_1_recording_workflow() {
        // Create a temporary directory for test scripts
        let temp_dir = TempDir::new().unwrap();
        let script_service = ScriptService::new(temp_dir.path().to_path_buf());

        // Step 1: Load the sample recorded journey
        let sample_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("sample-login-journey.json");

        let script_content = std::fs::read_to_string(&sample_path).unwrap();
        let mut script: TestScript = serde_json::from_str(&script_content).unwrap();

        // Step 2: Validate the script structure
        let validation_result = script_service.validate_script(&script);
        assert!(validation_result.is_ok(), "Script should be valid");

        // Step 3: Verify script has multiple selector strategies
        for (index, step) in script.steps.iter().enumerate() {
            match step.action.as_str() {
                "navigate" | "wait" => {
                    // These steps don't need selectors
                    assert!(step.selectors.is_empty(),
                        "Step {} ({}) should not have selectors",
                        index + 1, step.action);
                }
                "click" | "type" => {
                    // These steps should have multiple selectors
                    assert!(!step.selectors.is_empty(),
                        "Step {} ({}) should have selectors",
                        index + 1, step.action);

                    // Check that we have multiple selector types
                    let selector_types: std::collections::HashSet<_> =
                        step.selectors.iter()
                            .map(|s| s.selector_type.as_str())
                            .collect();

                    assert!(selector_types.len() > 1,
                        "Step {} should have multiple selector types, found: {:?}",
                        index + 1, selector_types);

                    // Check priorities are unique and sequential
                    let priorities: Vec<u32> = step.selectors.iter()
                        .map(|s| s.priority)
                        .collect();
                    let unique_priorities: std::collections::HashSet<_> =
                        priorities.iter().collect();
                    assert_eq!(priorities.len(), unique_priorities.len(),
                    "Step {} should have unique priorities", index + 1);
                }
                _ => {}
            }
        }

        // Step 4: Save the script
        let save_result = script_service.save_script(&mut script);
        assert!(save_result.is_ok(), "Script should save successfully");

        // Step 5: Load the script back
        let loaded_script = script_service.load_script(&script.id);
        assert!(loaded_script.is_ok(), "Script should load successfully");

        let loaded = loaded_script.unwrap();
        assert_eq!(loaded.name, script.name);
        assert_eq!(loaded.steps.len(), script.steps.len());

        // Step 6: Verify the script represents a complete journey
        assert_eq!(script.name, "Login Journey Test");
        assert!(script.description.is_some());
        assert!(script.tags.contains(&"login".to_string()));
        assert!(script.tags.contains(&"search".to_string()));

        // Check we have the expected steps in order
        let step_actions: Vec<&str> = script.steps.iter()
            .map(|s| s.action.as_str())
            .collect();

        assert_eq!(step_actions, vec![
            "navigate",  // Navigate to login
            "type",      // Enter username
            "type",      // Enter password
            "click",     // Click login button
            "wait",      // Wait for dashboard
            "type",      // Enter search
            "click",     // Click search button
            "wait",      // Wait for results
            "click"      // Click logout
        ]);

        // Step 7: Verify specific step details
        // Check click step has multiple selectors
        let login_button_step = &script.steps[3]; // Click login button
        assert_eq!(login_button_step.action, "click");
        assert!(login_button_step.selectors.len() >= 5);

        // Check ID selector has highest priority
        let id_selector = login_button_step.selectors.iter()
            .find(|s| s.selector_type == "id");
        assert!(id_selector.is_some());
        assert_eq!(id_selector.unwrap().priority, 1);
        assert_eq!(id_selector.unwrap().value, "login-button");

        // Check type step has correct value
        let username_step = &script.steps[1]; // Enter username
        assert_eq!(username_step.action, "type");
        assert_eq!(username_step.value, Some("testuser@example.com".to_string()));

        println!("✅ User Story 1 Test Passed: Successfully recorded and validated login journey");
        println!("   - Script: {}", script.name);
        println!("   - Steps: {}", script.steps.len());
        println!("   - Selector strategies per step: {:?}",
            script.steps.iter()
                .filter(|s| !s.selectors.is_empty())
                .map(|s| s.selectors.len())
                .collect::<Vec<_>>());
    }

    #[test]
    fn test_selector_fallback_strategy() {
        // Test that our selector generation creates proper fallback strategies
        use uitrace_desktop::recorder::selector_generator::{SelectorGenerator, ElementInfo};

        let element = ElementInfo::new("button".to_string())
            .with_id("submit-btn".to_string())
            .with_class("btn btn-primary".to_string())
            .with_name("submit".to_string())
            .with_text("Submit Form".to_string());

        let selectors = SelectorGenerator::generate_selectors(&element);

        // Should have multiple selector types
        let selector_types: std::collections::HashSet<_> =
            selectors.iter().map(|s| s.selector_type.as_str()).collect();

        assert!(selector_types.contains(&"id"));
        assert!(selector_types.contains(&"css"));
        assert!(selector_types.contains(&"xpath"));
        assert!(selector_types.contains(&"name"));

        // ID should have highest priority
        let id_selector = selectors.iter()
            .find(|s| s.selector_type == "id")
            .unwrap();
        assert_eq!(id_selector.priority, 1);
        assert_eq!(id_selector.value, "submit-btn");
    }
}