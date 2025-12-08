use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;
use tokio::time::{sleep, Duration};
use thirtyfour::prelude::*;
use uitrace_desktop::models::{TestScript, TestStep};
use uitrace_desktop::data::{CsvParser, DataManagerEnhanced, VariableSubstitutor};
use uitrace_desktop::executor::ScriptExecutor;

#[tokio::test]
async fn test_e2e_data_driven_csv_import_and_execution() {
    // Setup test environment
    let temp_dir = TempDir::new().unwrap();
    let csv_path = temp_dir.path().join("test_users.csv");

    // Create test CSV data
    let csv_content = r#"username,password,email,expected_message
alice@example.com,password123,alice@example.com,Welcome Alice
bob@example.com,secret456,bob@example.com,Welcome Bob
carol@example.com,test789,carol@example.com,Welcome Carol"#;

    fs::write(&csv_path, csv_content).unwrap();

    // Create a test web server for our E2E test
    let test_html = r#"
    <!DOCTYPE html>
    <html>
    <head><title>Login Test</title></head>
    <body>
        <form id="login-form">
            <input type="text" id="username" placeholder="Username" />
            <input type="password" id="password" placeholder="Password" />
            <button type="submit" id="login-btn">Login</button>
        </form>
        <div id="welcome-message" style="display:none;"></div>
        <script>
            document.getElementById('login-form').addEventListener('submit', function(e) {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const welcomeMsg = document.getElementById('welcome-message');
                welcomeMsg.textContent = 'Welcome ' + username.charAt(0).toUpperCase() + username.slice(1).split('@')[0];
                welcomeMsg.style.display = 'block';
            });
        </script>
    </body>
    </html>
    "#;

    let html_path = temp_dir.path().join("test_login.html");
    fs::write(&html_path, test_html).unwrap();

    // Convert to file:// URL
    let file_url = format!("file://{}", html_path.to_str().unwrap());

    // Step 1: Parse CSV data
    let csv_parser = CsvParser::new();
    let test_data = csv_parser.parse(&csv_path).await.unwrap();

    assert_eq!(test_data.rows.len(), 3);
    assert_eq!(test_data.headers, vec!["username", "password", "email", "expected_message"]);

    // Step 2: Create base test script with variable placeholders
    let mut base_script = TestScript::new("Data-Driven Login Test".to_string(), "test_user".to_string());

    let step1 = TestStep::new(1, "Navigate to login page".to_string(), "navigate".to_string())
        .with_value(&file_url);

    let step2 = TestStep::new(2, "Enter username".to_string(), "type".to_string())
        .with_value("${username}")
        .add_selector("id".to_string(), "#username".to_string(), 1);

    let step3 = TestStep::new(3, "Enter password".to_string(), "type".to_string())
        .with_value("${password}")
        .add_selector("id".to_string(), "#password".to_string(), 1);

    let step4 = TestStep::new(4, "Click login button".to_string(), "click".to_string())
        .add_selector("id".to_string(), "#login-btn".to_string(), 1);

    let step5 = TestStep::new(5, "Verify welcome message".to_string(), "verify".to_string())
        .with_value("${expected_message}")
        .add_selector("id".to_string(), "#welcome-message".to_string(), 1);

    base_script.steps.push(step1);
    base_script.steps.push(step2);
    base_script.steps.push(step3);
    base_script.steps.push(step4);
    base_script.steps.push(step5);

    // Step 3: Execute data-driven tests
    let data_manager = DataManagerEnhanced::new();
    let execution_results = data_manager.execute_data_driven(
        base_script.clone(),
        &test_data,
        None
    ).await.unwrap();

    // Step 4: Verify results
    assert_eq!(execution_results.len(), 3);

    for (index, result) in execution_results.iter().enumerate() {
        println!("Test case {}: {:?}", index + 1, result);

        // Each test case should have a substituted script
        assert!(result.substituted_script.is_some());

        let substituted_script = result.substituted_script.as_ref().unwrap();

        // Verify variable substitution worked correctly
        let data_row = &test_data.rows[index];

        // Check username substitution
        assert_eq!(
            substituted_script.steps[1].value.as_ref().unwrap(),
            &data_row.values["username"]
        );

        // Check password substitution
        assert_eq!(
            substituted_script.steps[2].value.as_ref().unwrap(),
            &data_row.values["password"]
        );

        // Check expected message substitution
        assert_eq!(
            substituted_script.steps[4].value.as_ref().unwrap(),
            &data_row.values["expected_message"]
        );

        // Verify no errors in substitution
        assert!(result.errors.is_empty());
    }
}

#[tokio::test]
async fn test_e2e_data_driven_with_validation_errors() {
    // Create test CSV with validation issues
    let temp_dir = TempDir::new().unwrap();
    let csv_path = temp_dir.path().join("invalid_data.csv");

    let csv_content = r#"username,age,email,score
valid_user,25,user@example.com,85.5
invalid_user,not_a_number,bad_email,invalid_score
young_user,10,kid@example.com,95.5
old_user,200,elder@example.com,105.0"#;

    fs::write(&csv_path, csv_content).unwrap();

    // Parse data
    let csv_parser = CsvParser::new();
    let test_data = csv_parser.parse(&csv_path).await.unwrap();

    // Create data manager with validation
    let data_manager = DataManagerEnhanced::new();

    // Validate each data row
    let mut validation_results = Vec::new();
    for data_row in &test_data.rows {
        let validation_result = data_manager.validate_data_row(data_row);
        validation_results.push(validation_result);
    }

    // Verify validation results
    assert_eq!(validation_results.len(), 4);

    // First row should be valid
    assert!(validation_results[0].is_valid);
    assert!(validation_results[0].errors.is_empty());

    // Second row should have multiple validation errors
    assert!(!validation_results[1].is_valid);
    assert!(validation_results[1].errors.len() >= 2);
    let error_messages: Vec<String> = validation_results[1].errors.iter().map(|e| e.to_string()).collect();
    assert!(error_messages.iter().any(|e| e.contains("age") && e.contains("number")));
    assert!(error_messages.iter().any(|e| e.contains("email") && e.contains("invalid")));

    // Third row should have age validation error (too young)
    assert!(!validation_results[2].is_valid);
    assert!(validation_results[2].errors.iter().any(|e| e.contains("age")));

    // Fourth row should have age and score validation errors
    assert!(!validation_results[3].is_valid);
    assert!(validation_results[3].errors.len() >= 2);
    assert!(validation_results[3].errors.iter().any(|e| e.contains("age")));
    assert!(validation_results[3].errors.iter().any(|e| e.contains("score")));
}

#[tokio::test]
async fn test_e2e_data_driven_performance() {
    // Create large CSV file for performance testing
    let temp_dir = TempDir::new().unwrap();
    let csv_path = temp_dir.path().join("large_dataset.csv");

    // Generate 1000 test rows
    let mut csv_content = String::from("id,username,email,data_value\n");
    for i in 0..1000 {
        csv_content.push_str(&format!(
            "{},{},user{}@example.com,value{}\n",
            i,
            format!("user_{}", i),
            i,
            i
        ));
    }

    fs::write(&csv_path, csv_content).unwrap();

    // Parse data
    let csv_parser = CsvParser::new();

    let start_time = std::time::Instant::now();
    let test_data = csv_parser.parse(&csv_path).await.unwrap();
    let parse_time = start_time.elapsed();

    assert_eq!(test_data.rows.len(), 1000);

    // Create simple test script
    let mut base_script = TestScript::new("Performance Test".to_string(), "test_user".to_string());
    let step = TestStep::new(1, "Test step".to_string(), "type".to_string())
        .with_value("${data_value}")
        .add_selector("id".to_string(), "#test-input".to_string(), 1);
    base_script.steps.push(step);

    // Execute data-driven substitution
    let data_manager = DataManagerEnhanced::new();
    let substitutor = VariableSubstitutor::new();

    let substitution_start = std::time::Instant::now();
    let mut processed_count = 0;

    for data_row in &test_data.rows {
        let context = data_manager.create_context(data_row);
        let substituted_script = substitutor.substitute_in_script(base_script.clone(), &context).unwrap();

        // Verify substitution worked
        assert_eq!(
            substituted_script.steps[0].value.as_ref().unwrap(),
            &data_row.values["data_value"]
        );

        processed_count += 1;
    }

    let substitution_time = substitution_start.elapsed();

    // Performance assertions
    assert_eq!(processed_count, 1000);
    println!("CSV parsing 1000 rows took: {:?}", parse_time);
    println!("Variable substitution for 1000 rows took: {:?}", substitution_time);
    println!("Average time per row: {:?}", substitution_time / 1000);

    // Should process 1000 rows in reasonable time
    assert!(parse_time.as_secs() < 5, "CSV parsing took too long");
    assert!(substitution_time.as_secs() < 10, "Variable substitution took too long");
}

#[tokio::test]
async fn test_e2e_data_driven_with_special_characters() {
    // Test CSV with special characters and edge cases
    let temp_dir = TempDir::new().unwrap();
    let csv_path = temp_dir.path().join("special_chars.csv");

    let csv_content = r#"username,password,special_value,unicode_text
user1,pass123,"Hello, World!","English text"
user2,pass456,"Line1
Line2","你好世界"
user3,pass789,"Tab	Separated","🌍🌎🌏"
user4,pass000,"Quote""test"","Café résumé""#;

    fs::write(&csv_path, csv_content).unwrap();

    // Parse data
    let csv_parser = CsvParser::new();
    let test_data = csv_parser.parse(&csv_path).await.unwrap();

    assert_eq!(test_data.rows.len(), 4);

    // Create test script with special character handling
    let mut base_script = TestScript::new("Special Characters Test".to_string(), "test_user".to_string());

    let step1 = TestStep::new(1, "Enter special value".to_string(), "type".to_string())
        .with_value("${special_value}")
        .add_selector("id".to_string(), "#special-input".to_string(), 1);

    let step2 = TestStep::new(2, "Enter unicode text".to_string(), "type".to_string())
        .with_value("${unicode_text}")
        .add_selector("id".to_string(), "#unicode-input".to_string(), 1);

    base_script.steps.push(step1);
    base_script.steps.push(step2);

    // Execute substitution
    let data_manager = DataManagerEnhanced::new();
    let substitutor = VariableSubstitutor::new();

    for (index, data_row) in test_data.rows.iter().enumerate() {
        let context = data_manager.create_context(data_row);
        let substituted_script = substitutor.substitute_in_script(base_script.clone(), &context).unwrap();

        // Verify special characters are preserved
        assert_eq!(
            substituted_script.steps[0].value.as_ref().unwrap(),
            &data_row.values["special_value"]
        );
        assert_eq!(
            substituted_script.steps[1].value.as_ref().unwrap(),
            &data_row.values["unicode_text"]
        );

        println!("Row {}: special_value='{}', unicode_text='{}'",
                 index + 1,
                 data_row.values["special_value"],
                 data_row.values["unicode_text"]);
    }
}

// Helper implementation for DataManagerEnhanced validation
impl DataManagerEnhanced {
    pub fn validate_data_row(&self, data_row: &uitrace_desktop::data::DataRow) -> ValidationResult {
        let mut errors = Vec::new();

        for (key, value) in &data_row.values {
            match key.as_str() {
                "age" => {
                    if !value.is_empty() {
                        if let Ok(age) = value.parse::<i32>() {
                            if age < 13 || age > 120 {
                                errors.push(format!("Age {} is out of valid range (13-120)", age));
                            }
                        } else {
                            errors.push(format!("Age '{}' is not a valid number", value));
                        }
                    }
                },
                "email" => {
                    if !value.is_empty() {
                        let email_regex = regex::Regex::new(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").unwrap();
                        if !email_regex.is_match(value) {
                            errors.push(format!("Email '{}' is invalid", value));
                        }
                    }
                },
                "score" => {
                    if !value.is_empty() {
                        if let Ok(score) = value.parse::<f64>() {
                            if score < 0.0 || score > 100.0 {
                                errors.push(format!("Score {} is out of valid range (0-100)", score));
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