use std::fs;
use std::path::PathBuf;
use uitrace_desktop::data::{CsvParser, DataManagerEnhanced, VariableSubstitutor};
use uitrace_desktop::models::{TestScript, TestStep};

#[tokio::test]
async fn test_sample_login_data_driven_execution() {
    let csv_path = PathBuf::from("tests/sample_data/login_test_data.csv");

    // Parse sample CSV data
    let csv_parser = CsvParser::new();
    let test_data = csv_parser.parse(&csv_path).await.unwrap();

    println!("Loaded {} test cases from login_test_data.csv", test_data.rows.len());

    // Verify data structure
    assert_eq!(test_data.headers, vec!["username", "password", "email", "expected_message", "login_button_text"]);
    assert_eq!(test_data.rows.len(), 5);

    // Create base test script with variable placeholders
    let mut base_script = TestScript::new("Login Data-Driven Test".to_string(), "test_user".to_string());

    let step1 = TestStep::new(1, "Navigate to login page".to_string(), "navigate".to_string())
        .with_value("https://example.com/login");

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

    // Execute data-driven tests
    let data_manager = DataManagerEnhanced::new();
    let results = data_manager.execute_data_driven(
        base_script.clone(),
        &test_data,
        None
    ).await.unwrap();

    // Verify results
    assert_eq!(results.len(), 5);

    for (index, result) in results.iter().enumerate() {
        println!("Test case {}: {:?}", index + 1, result);

        // Verify substitution worked
        assert!(result.substituted_script.is_some());
        assert!(result.errors.is_empty());

        let substituted_script = result.substituted_script.as_ref().unwrap();
        let data_row = &test_data.rows[index];

        // Verify username substitution
        assert_eq!(
            substituted_script.steps[1].value.as_ref().unwrap(),
            &data_row.values["username"]
        );

        // Verify password substitution
        assert_eq!(
            substituted_script.steps[2].value.as_ref().unwrap(),
            &data_row.values["password"]
        );

        // Verify expected message substitution
        assert_eq!(
            substituted_script.steps[4].value.as_ref().unwrap(),
            &data_row.values["expected_message"]
        );
    }
}

#[tokio::test]
async fn test_sample_ecommerce_data_validation() {
    let csv_path = PathBuf::from("tests/sample_data/ecommerce_test_data.csv");

    // Parse sample CSV data
    let csv_parser = CsvParser::new();
    let test_data = csv_parser.parse(&csv_path).await.unwrap();

    println!("Loaded {} test cases from ecommerce_test_data.csv", test_data.rows.len());

    // Verify data structure
    assert_eq!(test_data.headers, vec!["product_name", "product_id", "price", "quantity", "expected_total", "shipping_method"]);
    assert_eq!(test_data.rows.len(), 5);

    // Validate each data row
    let data_manager = DataManagerEnhanced::new();

    for (index, data_row) in test_data.rows.iter().enumerate() {
        println!("Validating row {}: {:?}", index + 1, data_row.values);

        // Basic validation - check that numeric fields are actually numbers
        let price = data_row.values["price"].parse::<f64>();
        assert!(price.is_ok(), "Price should be a valid number");

        let quantity = data_row.values["quantity"].parse::<i32>();
        assert!(quantity.is_ok(), "Quantity should be a valid integer");

        let expected_total = data_row.values["expected_total"].parse::<f64>();
        assert!(expected_total.is_ok(), "Expected total should be a valid number");

        // Verify shipping method is from allowed list
        let shipping_method = &data_row.values["shipping_method"];
        assert!(
            shipping_method == "Standard" ||
            shipping_method == "Express" ||
            shipping_method == "Priority",
            "Shipping method should be Standard, Express, or Priority"
        );
    }
}

#[tokio::test]
async fn test_sample_form_validation_data_types() {
    let csv_path = PathBuf::from("tests/sample_data/form_validation_data.csv");

    // Parse sample CSV data
    let csv_parser = CsvParser::new();
    let test_data = csv_parser.parse(&csv_path).await.unwrap();

    println!("Loaded {} validation test cases from form_validation_data.csv", test_data.rows.len());

    // Create validation test script
    let mut base_script = TestScript::new("Form Validation Data-Driven Test".to_string(), "test_user".to_string());

    let step1 = TestStep::new(1, "Enter field value".to_string(), "type".to_string())
        .with_value("${field_value}")
        .add_selector("id".to_string(), "#${field_name}".to_string(), 1);

    let step2 = TestStep::new(2, "Verify validation result".to_string(), "verify".to_string())
        .with_value("${error_message}")
        .add_selector("id".to_string(), "#${field_name}-error".to_string(), 1);

    base_script.steps.push(step1);
    base_script.steps.push(step2);

    // Execute data-driven validation tests
    let data_manager = DataManagerEnhanced::new();
    let substitutor = VariableSubstitutor::new();

    for (index, data_row) in test_data.rows.iter().enumerate() {
        println!("Testing validation case {}: {} = {}",
                 index + 1,
                 data_row.values["field_name"],
                 data_row.values["field_value"]);

        let context = data_manager.create_context(data_row);
        let substituted_script = substitutor.substitute_in_script(base_script.clone(), &context).unwrap();

        // Verify substitutions worked correctly
        assert_eq!(
            substituted_script.steps[0].value.as_ref().unwrap(),
            &data_row.values["field_value"]
        );

        // Verify field name substitution in selectors
        let selector = &substituted_script.steps[0].selectors[0];
        assert_eq!(
            selector.value,
            format!("#{}", data_row.values["field_name"])
        );

        // Verify error message substitution
        assert_eq!(
            substituted_script.steps[1].value.as_ref().unwrap(),
            &data_row.values["error_message"]
        );
    }
}

#[tokio::test]
async fn test_all_sample_files_parsing() {
    let sample_files = vec![
        "tests/sample_data/login_test_data.csv",
        "tests/sample_data/ecommerce_test_data.csv",
        "tests/sample_data/form_validation_data.csv"
    ];

    let csv_parser = CsvParser::new();

    for file_path in sample_files {
        println!("Testing file: {}", file_path);

        let csv_path = PathBuf::from(file_path);
        let test_data = csv_parser.parse(&csv_path).await;

        assert!(test_data.is_ok(), "Failed to parse {}: {:?}", file_path, test_data.err());

        let data = test_data.unwrap();
        assert!(!data.headers.is_empty(), "File {} should have headers", file_path);
        assert!(!data.rows.is_empty(), "File {} should have data rows", file_path);

        println!("✓ {}: {} headers, {} rows", file_path, data.headers.len(), data.rows.len());
    }
}

#[tokio::test]
async fn test_sample_data_performance() {
    let csv_path = PathBuf::from("tests/sample_data/login_test_data.csv");

    let csv_parser = CsvParser::new();
    let test_data = csv_parser.parse(&csv_path).await.unwrap();

    // Create a more complex script to test substitution performance
    let mut base_script = TestScript::new("Performance Test".to_string(), "test_user".to_string());

    // Add 10 steps with variable substitutions
    for i in 1..=10 {
        let step = TestStep::new(i, format!("Test step {}", i), "type".to_string())
            .with_value(format!("${{username}}_step{}_${{password}}", i))
            .add_selector("id".to_string(), format!("#input-{}", i), 1);
        base_script.steps.push(step);
    }

    let data_manager = DataManagerEnhanced::new();
    let substitutor = VariableSubstitutor::new();

    let start_time = std::time::Instant::now();

    for data_row in &test_data.rows {
        let context = data_manager.create_context(data_row);
        let _substituted_script = substitutor.substitute_in_script(base_script.clone(), &context).unwrap();
    }

    let elapsed = start_time.elapsed();
    println!("Substituted {} data rows with 10-step script in {:?}", test_data.rows.len(), elapsed);

    // Should complete quickly even with complex substitution
    assert!(elapsed.as_millis() < 1000, "Substitution took too long: {:?}", elapsed);
}