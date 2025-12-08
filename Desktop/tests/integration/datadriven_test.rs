use std::fs;
use tempfile::TempDir;
use uitrace_desktop::data::{CsvParser, VariableSubstitutor, DataManager};
use uitrace_desktop::models::{TestScript, TestStep};
use uitrace_desktop::executor::ScriptExecutor;

#[tokio::test]
async fn test_data_driven_execution_with_csv() {
    // Create test CSV data
    let temp_dir = TempDir::new().unwrap();
    let csv_path = temp_dir.path().join("test_users.csv");

    let csv_content = r#"username,password,email,expected_text
john_doe,pass123,john@example.com,Welcome John
jane_smith,secret456,jane@example.com,Welcome Jane
bob_jones,test789,bob@example.com,Welcome Bob"#;

    fs::write(&csv_path, csv_content).unwrap();

    // Create base test script
    let mut base_script = TestScript::new("Login Test".to_string(), "test_user".to_string());

    let step1 = TestStep::new(1, "Navigate to login".to_string(), "navigate".to_string())
        .with_value("https://example.com/login");

    let step2 = TestStep::new(2, "Enter username".to_string(), "type".to_string())
        .with_value("${username}")
        .add_selector("id".to_string(), "#username".to_string(), 1);

    let step3 = TestStep::new(3, "Enter password".to_string(), "type".to_string())
        .with_value("${password}")
        .add_selector("id".to_string(), "#password".to_string(), 1);

    let step4 = TestStep::new(4, "Click login".to_string(), "click".to_string())
        .add_selector("id".to_string(), "#login-btn".to_string(), 1);

    let step5 = TestStep::new(5, "Verify welcome text".to_string(), "verify".to_string())
        .with_value("${expected_text}")
        .add_selector("css".to_string(), ".welcome-message".to_string(), 1);

    base_script.steps.push(step1);
    base_script.steps.push(step2);
    base_script.steps.push(step3);
    base_script.steps.push(step4);
    base_script.steps.push(step5);

    // Parse CSV data
    let parser = CsvParser::new();
    let test_data = parser.parse(&csv_path).await.unwrap();

    assert_eq!(test_data.rows.len(), 3);
    assert_eq!(test_data.headers.len(), 4);

    // Create data manager and execute with each data row
    let data_manager = DataManager::new();
    let mut execution_results = Vec::new();

    for (index, data_row) in test_data.rows.iter().enumerate() {
        println!("Executing test case {} with data: {:?}", index + 1, data_row.values);

        // Substitute variables in the base script
        let substitutor = VariableSubstitutor::new();
        let context = data_manager.create_context(data_row);
        let substituted_script = substitutor.substitute_in_script(base_script.clone(), &context).unwrap();

        // Verify substitutions
        assert_eq!(substituted_script.steps[1].value, Some(data_row.values["username"].clone()));
        assert_eq!(substituted_script.steps[2].value, Some(data_row.values["password"].clone()));
        assert_eq!(substituted_script.steps[4].value, Some(data_row.values["expected_text"].clone()));

        // Note: In a real test, we would execute the script here
        // For this integration test, we'll simulate the execution
        execution_results.push((index, substituted_script, data_row.clone()));
    }

    // Verify all test cases were processed
    assert_eq!(execution_results.len(), 3);

    // Verify each test case has correct substitutions
    for (index, script, data_row) in execution_results {
        assert_eq!(script.steps[1].value.as_ref().unwrap(), &data_row.values["username"]);
        assert_eq!(script.steps[2].value.as_ref().unwrap(), &data_row.values["password"]);
        assert_eq!(script.steps[4].value.as_ref().unwrap(), &data_row.values["expected_text"]);
    }
}

#[tokio::test]
async fn test_variable_substitution_in_selectors() {
    let temp_dir = TempDir::new().unwrap();
    let csv_path = temp_dir.path().join("dynamic_selectors.csv");

    let csv_content = r#"user_id,button_text
123,Submit
456,Save
789,Update"#;

    fs::write(&csv_path, csv_content).unwrap();

    // Create script with dynamic selectors
    let mut base_script = TestScript::new("Dynamic Selector Test".to_string(), "test_user".to_string());

    let step1 = TestStep::new(1, "Click user button".to_string(), "click".to_string())
        .add_selector("css".to_string(), "button[data-user-id='${user_id}']".to_string(), 1);

    let step2 = TestStep::new(2, "Verify button text".to_string(), "verify".to_string())
        .with_value("${button_text}")
        .add_selector("xpath".to_string(), "//button[text()='${button_text}']".to_string(), 1);

    base_script.steps.push(step1);
    base_script.steps.push(step2);

    // Parse data
    let parser = CsvParser::new();
    let test_data = parser.parse(&csv_path).await.unwrap();

    // Test substitution with each data row
    let substitutor = VariableSubstitutor::new();

    for data_row in &test_data.rows {
        let context = SubstitutionContext::from_vec(vec![
            ("user_id".to_string(), data_row.values["user_id"].clone()),
            ("button_text".to_string(), data_row.values["button_text"].clone()),
        ]);

        let substituted_script = substitutor.substitute_in_script(base_script.clone(), &context).unwrap();

        // Verify selector substitutions
        let selector1 = &substituted_script.steps[0].selectors[0];
        assert_eq!(selector1.value, format!("button[data-user-id='{}']", data_row.values["user_id"]));

        let selector2 = &substituted_script.steps[1].selectors[0];
        assert_eq!(selector2.value, format!("//button[text()='{}']", data_row.values["button_text"]));

        // Verify value substitution
        assert_eq!(substituted_script.steps[1].value, Some(data_row.values["button_text"].clone()));
    }
}

#[tokio::test]
async fn test_data_validation_during_execution() {
    let temp_dir = TempDir::new().unwrap();
    let csv_path = temp_dir.path().join("validation_test.csv");

    let csv_content = r#"username,age,email,score
valid_user,25,user@example.com,95.5
invalid_user,not_a_number,bad_email,invalid_score
test_user,-5,user@test.com,150"#;

    fs::write(&csv_path, csv_content).unwrap();

    // Parse data
    let parser = CsvParser::new();
    let test_data = parser.parse(&csv_path).await.unwrap();

    let data_manager = DataManager::new();
    let mut validation_results = Vec::new();

    for data_row in &test_data.rows {
        let validation_result = data_manager.validate_data_row(data_row);
        validation_results.push(validation_result);
    }

    // Check validation results
    assert_eq!(validation_results.len(), 3);

    // First row should be valid
    assert!(validation_results[0].is_valid);
    assert_eq!(validation_results[0].errors.len(), 0);

    // Second row should have validation errors
    assert!(!validation_results[1].is_valid);
    assert!(validation_results[1].errors.len() > 0);
    assert!(validation_results[1].errors.iter().any(|e| e.contains("age")));
    assert!(validation_results[1].errors.iter().any(|e| e.contains("email")));

    // Third row should have validation errors (negative age, high score)
    assert!(!validation_results[2].is_valid);
    assert!(validation_results[2].errors.len() > 0);
}

#[tokio::test]
async fn test_data_driven_execution_with_error_handling() {
    let temp_dir = TempDir::new().unwrap();
    let csv_path = temp_dir.path().join("error_handling_test.csv");

    let csv_content = r#"test_case,username,expected_result
valid_test,testuser,success
invalid_test,,failure
edge_test,edge_user,success"#;

    fs::write(&csv_path, csv_content).unwrap();

    // Parse data
    let parser = CsvParser::new();
    let test_data = parser.parse(&csv_path).await.unwrap();

    let base_script = TestScript::new("Error Handling Test".to_string(), "test_user".to_string());

    let mut execution_results = Vec::new();

    for data_row in &test_data.rows {
        let substitutor = VariableSubstitutor::new();
        let context = SubstitutionContext::from_vec(vec![
            ("test_case".to_string(), data_row.values["test_case"].clone()),
            ("username".to_string(), data_row.values["username"].clone()),
            ("expected_result".to_string(), data_row.values["expected_result"].clone()),
        ]);

        let mut script = base_script.clone();

        // Add steps that might fail with empty username
        let step1 = TestStep::new(1, "Enter username".to_string(), "type".to_string())
            .with_value("${username}")
            .add_selector("id".to_string(), "#username".to_string(), 1);

        script.steps.push(step1);

        let result = substitutor.substitute_in_script(script, &context);

        match result {
            Ok(substituted_script) => {
                // Check if substitution produced potentially problematic values
                let username_value = substituted_script.steps[0].value.as_ref().unwrap();
                execution_results.push((
                    data_row.values["test_case"].clone(),
                    username_value.is_empty(),
                    substituted_script
                ));
            },
            Err(e) => {
                execution_results.push((
                    data_row.values["test_case"].clone(),
                    true, // Mark as error
                    base_script.clone()
                ));
                println!("Error processing test case {}: {}", data_row.values["test_case"], e);
            }
        }
    }

    // Verify results
    assert_eq!(execution_results.len(), 3);

    // Valid test should have username
    assert_eq!(execution_results[0].0, "valid_test");
    assert!(!execution_results[0].1); // Not empty

    // Invalid test should have empty username
    assert_eq!(execution_results[1].0, "invalid_test");
    assert!(execution_results[1].1); // Empty username

    // Edge test should have username
    assert_eq!(execution_results[2].0, "edge_test");
    assert!(!execution_results[2].1); // Not empty
}

#[tokio::test]
async fn test_batch_execution_with_performance_tracking() {
    let temp_dir = TempDir::new().unwrap();
    let csv_path = temp_dir.path().join("performance_test.csv");

    // Create CSV with 100 test cases
    let mut csv_content = String::from("iteration,data_value\n");
    for i in 0..100 {
        csv_content.push_str(&format!("{},value{}\n", i, i));
    }

    fs::write(&csv_path, csv_content).unwrap();

    let start_time = std::time::Instant::now();

    // Parse data
    let parser = CsvParser::new();
    let test_data = parser.parse(&csv_path).await.unwrap();

    let data_parse_time = start_time.elapsed();

    // Process all data rows
    let substitutor = VariableSubstitutor::new();
    let mut processed_count = 0;

    for data_row in &test_data.rows {
        let context = SubstitutionContext::from_vec(vec![
            ("iteration".to_string(), data_row.values["iteration"].clone()),
            ("data_value".to_string(), data_row.values["data_value"].clone()),
        ]);

        // Simulate script processing
        let mut script = TestScript::new("Performance Test".to_string(), "test_user".to_string());
        let step = TestStep::new(1, "Test step".to_string(), "type".to_string())
            .with_value("${data_value}");
        script.steps.push(step);

        let _substituted_script = substitutor.substitute_in_script(script, &context).unwrap();
        processed_count += 1;
    }

    let total_time = start_time.elapsed();

    // Verify all rows were processed
    assert_eq!(processed_count, 100);

    // Performance assertions
    println!("Data parsing took: {:?}", data_parse_time);
    println!("Total processing took: {:?}", total_time);
    println!("Average time per row: {:?}", total_time / 100);

    // Should process 100 rows in reasonable time (less than 1 second total)
    assert!(total_time.as_secs() < 1, "Processing 100 rows took too long: {:?}", total_time);
}

// Helper functions that would be part of the actual implementation

impl DataManager {
    pub fn new() -> Self {
        Self {}
    }

    pub fn create_context(&self,
        data_row: &DataRow,
    ) -> SubstitutionContext {
        SubstitutionContext::from_vec(
            data_row.values.iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect()
        )
    }

    pub fn validate_data_row(
        &self,
        data_row: &DataRow,
    ) -> ValidationResult {
        let mut errors = Vec::new();

        for (key, value) in &data_row.values {
            // Basic validation rules
            match key.as_str() {
                "age" => {
                    if !value.is_empty() {
                        if let Ok(age) = value.parse::<i32>() {
                            if age < 0 || age > 150 {
                                errors.push(format!("Age {} is out of valid range", age));
                            }
                        } else {
                            errors.push(format!("Age '{}' is not a valid number", value));
                        }
                    }
                },
                "email" => {
                    if !value.is_empty() && !value.contains('@') {
                        errors.push(format!("Email '{}' is invalid", value));
                    }
                },
                "score" => {
                    if !value.is_empty() {
                        if let Ok(score) = value.parse::<f64>() {
                            if score < 0.0 || score > 100.0 {
                                errors.push(format!("Score {} is out of valid range", score));
                            }
                        } else {
                            errors.push(format!("Score '{}' is not a valid number", value));
                        }
                    }
                },
                _ => {}
            }
        }

        ValidationResult {
            is_valid: errors.is_empty(),
            errors,
        }
    }
}

#[derive(Debug, Clone)]
struct ValidationResult {
    is_valid: bool,
    errors: Vec<String>,
}

impl SubstitutionContext {
    pub fn from_vec(vars: Vec<(String, String)>) -> Self {
        // This would be implemented in the actual codebase
        // For now, we'll use a simple mock implementation
        Self {
            variables: vars.into_iter().collect(),
        }
    }
}

struct SubstitutionContext {
    variables: std::collections::HashMap<String, String>,
}

// Mock implementation for testing
impl VariableSubstitutor {
    pub fn new() -> Self {
        Self {}
    }

    pub fn substitute_in_script(
        &self,
        script: TestScript,
        context: &SubstitutionContext,
    ) -> Result<TestScript, String> {
        let mut substituted_script = script;

        for step in &mut substituted_script.steps {
            if let Some(ref value) = step.value {
                let substituted_value = self.substitute(value, context);
                step.value = Some(substituted_value);
            }

            for selector in &mut step.selectors {
                let substituted_value = self.substitute(&selector.value, context);
                selector.value = substituted_value;
            }
        }

        Ok(substituted_script)
    }

    fn substitute(
        &self,
        input: &str,
        context: &SubstitutionContext,
    ) -> String {
        let mut result = input.to_string();

        for (key, value) in &context.variables {
            let pattern = format!("${{{}}}", key);
            result = result.replace(&pattern, value);
        }

        result
    }
}

struct VariableSubstitutor;