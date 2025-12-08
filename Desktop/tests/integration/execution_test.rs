use uitrace_desktop::models::{TestScript, TestStep, Selector};
use uitrace_desktop::executor::{ScriptExecutor, ExecutionConfig};
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::test]
async fn test_script_execution_flow() {
    // Create a simple test script
    let mut script = TestScript::new("Integration Test Script".to_string(), "test_user".to_string())
        .with_description("Test script for integration testing".to_string());

    // Add test steps
    let step1 = TestStep::new(1, "Navigate to test page".to_string(), "navigate".to_string())
        .with_value("https://example.com".to_string())
        .with_timeout(10);

    let step2 = TestStep::new(2, "Click login button".to_string(), "click".to_string())
        .add_selector("id".to_string(), "#login-btn".to_string(), 1)
        .add_selector("css".to_string(), ".login-button".to_string(), 2)
        .with_timeout(5);

    let step3 = TestStep::new(3, "Enter username".to_string(), "type".to_string())
        .with_value("testuser@example.com".to_string())
        .add_selector("id".to_string(), "#username".to_string(), 1)
        .with_timeout(5);

    script = script.add_step(step1).add_step(step2).add_step(step3);

    // Create execution config
    let config = ExecutionConfig {
        max_retries: 3,
        base_delay_ms: 1000,
        timeout_ms: 30000,
        browser_type: "chrome".to_string(),
        headless: true,
        ..Default::default()
    };

    // Create script executor
    let executor = ScriptExecutor::new(config);

    // Execute script
    let result = executor.execute_script(script).await;

    // Verify execution completed
    assert!(result.is_ok(), "Script execution should succeed");

    let execution_result = result.unwrap();
    assert_eq!(execution_result.total_steps, 3);
    assert_eq!(execution_result.completed_steps, 3);
    assert_eq!(execution_result.failed_steps, 0);
    assert!(execution_result.success_rate > 0.9);
}

#[tokio::test]
async fn test_fault_tolerant_execution() {
    // Create a script with selectors that will fail initially
    let mut script = TestScript::new("Fault Tolerance Test".to_string(), "test_user".to_string());

    // First selector will fail, second should succeed
    let step = TestStep::new(1, "Click button with fallback".to_string(), "click".to_string())
        .add_selector("id".to_string(), "#nonexistent-id".to_string(), 1)  // Will fail
        .add_selector("css".to_string(), ".real-button".to_string(), 2)    // Should succeed
        .add_selector("xpath".to_string(), "//button[text()='Submit']".to_string(), 3)
        .with_timeout(10);

    script = script.add_step(step);

    let config = ExecutionConfig {
        max_retries: 3,
        base_delay_ms: 500,
        timeout_ms: 20000,
        browser_type: "chrome".to_string(),
        headless: true,
        enable_fallback: true,
        ..Default::default()
    };

    let executor = ScriptExecutor::new(config);
    let result = executor.execute_script(script).await;

    assert!(result.is_ok(), "Fault-tolerant execution should succeed");

    let execution_result = result.unwrap();
    assert!(execution_result.fallback_used, "Should have used fallback selectors");
    assert_eq!(execution_result.completed_steps, 1);
}

#[tokio::test]
async fn test_execution_with_data_driven_testing() {
    let mut script = TestScript::new("Data Driven Test".to_string(), "test_user".to_string());

    // Create a parameterized step
    let step = TestStep::new(1, "Type username".to_string(), "type".to_string())
        .with_value("${username}")  // Variable substitution
        .add_selector("id".to_string(), "#username".to_string(), 1)
        .with_timeout(5);

    script = script.add_step(step);

    let config = ExecutionConfig {
        max_retries: 2,
        base_delay_ms: 1000,
        timeout_ms: 15000,
        browser_type: "chrome".to_string(),
        headless: true,
        ..Default::default()
    };

    let executor = ScriptExecutor::new(config);

    // Test data rows
    let test_data = vec![
        vec![("username".to_string(), "user1@example.com".to_string())],
        vec![("username".to_string(), "user2@example.com".to_string())],
        vec![("username".to_string(), "user3@example.com".to_string())],
    ];

    let mut all_results = Vec::new();

    for (index, data_row) in test_data.iter().enumerate() {
        let mut script_clone = script.clone();

        // Substitute variables in script
        for (key, value) in data_row {
            script_clone = substitute_variables(script_clone, key, value);
        }

        let result = executor.execute_script(script_clone).await;
        all_results.push((index, result));
    }

    // Verify all executions completed
    assert_eq!(all_results.len(), 3);

    for (index, result) in all_results {
        assert!(result.is_ok(), "Execution {} should succeed", index);
    }
}

#[tokio::test]
async fn test_execution_error_handling() {
    let mut script = TestScript::new("Error Handling Test".to_string(), "test_user".to_string());

    // Create a step that will fail
    let step = TestStep::new(1, "Click non-existent element".to_string(), "click".to_string())
        .add_selector("id".to_string(), "#definitely-does-not-exist".to_string(), 1)
        .add_selector("css".to_string(), ".also-does-not-exist".to_string(), 2)
        .with_timeout(3); // Short timeout

    script = script.add_step(step);

    let config = ExecutionConfig {
        max_retries: 2,
        base_delay_ms: 500,
        timeout_ms: 10000,
        browser_type: "chrome".to_string(),
        headless: true,
        enable_fallback: true,
        ..Default::default()
    };

    let executor = ScriptExecutor::new(config);
    let result = executor.execute_script(script).await;

    // Should fail gracefully
    assert!(result.is_ok(), "Execution should complete even with failures");

    let execution_result = result.unwrap();
    assert_eq!(execution_result.completed_steps, 0);
    assert_eq!(execution_result.failed_steps, 1);
    assert!(execution_result.errors.len() > 0);
    assert!(execution_result.success_rate < 1.0);
}

#[tokio::test]
async fn test_execution_performance_timing() {
    let mut script = TestScript::new("Performance Test".to_string(), "test_user".to_string());

    // Add multiple simple steps
    for i in 1..=5 {
        let step = TestStep::new(i, format!("Step {}", i), "navigate".to_string())
            .with_value(format!("https://example.com/page{}", i))
            .with_timeout(5);
        script.steps.push(step);
    }

    let config = ExecutionConfig {
        max_retries: 1,
        base_delay_ms: 100,
        timeout_ms: 30000,
        browser_type: "chrome".to_string(),
        headless: true,
        ..Default::default()
    };

    let executor = ScriptExecutor::new(config);

    let start_time = std::time::Instant::now();
    let result = executor.execute_script(script).await;
    let execution_time = start_time.elapsed();

    assert!(result.is_ok(), "Execution should succeed");

    let execution_result = result.unwrap();
    assert_eq!(execution_result.completed_steps, 5);

    // Verify performance target: sub-500ms per step (with some tolerance)
    let avg_time_per_step = execution_time.as_millis() / 5;
    assert!(avg_time_per_step < 1000, "Average time per step should be under 1 second");

    println!("Average time per step: {}ms", avg_time_per_step);
}

#[tokio::test]
async fn test_concurrent_execution_isolation() {
    let config = ExecutionConfig {
        max_retries: 2,
        base_delay_ms: 500,
        timeout_ms: 20000,
        browser_type: "chrome".to_string(),
        headless: true,
        ..Default::default()
    };

    let executor1 = ScriptExecutor::new(config.clone());
    let executor2 = ScriptExecutor::new(config.clone());

    let script1 = create_test_script("Script 1", "user1");
    let script2 = create_test_script("Script 2", "user2");

    // Execute scripts concurrently
    let (result1, result2) = tokio::join!(
        executor1.execute_script(script1),
        executor2.execute_script(script2)
    );

    assert!(result1.is_ok(), "First script should execute successfully");
    assert!(result2.is_ok(), "Second script should execute successfully");

    // Verify isolation - results should be independent
    let exec_result1 = result1.unwrap();
    let exec_result2 = result2.unwrap();

    assert_ne!(exec_result1.execution_id, exec_result2.execution_id);
    assert_eq!(exec_result1.completed_steps, 1);
    assert_eq!(exec_result2.completed_steps, 1);
}

// Helper function to create a simple test script
fn create_test_script(name: &str, user: &str) -> TestScript {
    let mut script = TestScript::new(name.to_string(), user.to_string());

    let step = TestStep::new(1, "Simple navigation".to_string(), "navigate".to_string())
        .with_value("https://example.com".to_string())
        .with_timeout(5);

    script.steps.push(step);
    script
}

// Helper function for variable substitution (simplified)
fn substitute_variables(script: TestScript, key: &str, value: &str) -> TestScript {
    // This is a simplified implementation
    // In real implementation, this would use a proper template engine
    let mut modified_script = script;

    for step in &mut modified_script.steps {
        if let Some(ref val) = step.value {
            if val.contains(&format!("${{{}}}", key)) {
                step.value = Some(val.replace(&format!("${{{}}}", key), value));
            }
        }
    }

    modified_script
}

#[tokio::test]
async fn test_execution_cleanup_on_failure() {
    let mut script = TestScript::new("Cleanup Test".to_string(), "test_user".to_string());

    let step = TestStep::new(1, "Failing step".to_string(), "click".to_string())
        .add_selector("id".to_string(), "#nonexistent".to_string(), 1)
        .with_timeout(2);

    script.steps.push(step);

    let config = ExecutionConfig {
        max_retries: 1,
        base_delay_ms: 100,
        timeout_ms: 5000,
        browser_type: "chrome".to_string(),
        headless: true,
        cleanup_on_failure: true,
        ..Default::default()
    };

    let executor = ScriptExecutor::new(config);
    let result = executor.execute_script(script).await;

    assert!(result.is_ok());

    let execution_result = result.unwrap();
    assert_eq!(execution_result.failed_steps, 1);

    // Verify cleanup was performed
    assert!(execution_result.cleanup_performed, "Cleanup should be performed on failure");
    assert!(execution_result.browser_closed, "Browser should be closed after failure");
}

#[tokio::test]
async fn test_execution_reporting() {
    let mut script = TestScript::new("Reporting Test".to_string(), "test_user".to_string());

    // Mix of successful and failed steps
    let step1 = TestStep::new(1, "Navigate".to_string(), "navigate".to_string())
        .with_value("https://example.com".to_string())
        .with_timeout(5);

    let step2 = TestStep::new(2, "Click non-existent".to_string(), "click".to_string())
        .add_selector("id".to_string(), "#does-not-exist".to_string(), 1)
        .with_timeout(2);

    let step3 = TestStep::new(3, "Navigate again".to_string(), "navigate".to_string())
        .with_value("https://example.com/about".to_string())
        .with_timeout(5);

    script.steps.push(step1);
    script.steps.push(step2);
    script.steps.push(step3);

    let config = ExecutionConfig {
        max_retries: 1,
        base_delay_ms: 100,
        timeout_ms: 20000,
        browser_type: "chrome".to_string(),
        headless: true,
        enable_reporting: true,
        ..Default::default()
    };

    let executor = ScriptExecutor::new(config);
    let result = executor.execute_script(script).await;

    assert!(result.is_ok());

    let execution_result = result.unwrap();

    // Verify reporting data
    assert!(execution_result.report_generated);
    assert!(execution_result.execution_log.len() > 0);
    assert!(execution_result.performance_metrics.is_some());

    let metrics = execution_result.performance_metrics.unwrap();
    assert!(metrics.total_duration_ms > 0);
    assert!(metrics.avg_step_duration_ms > 0);
    assert_eq!(metrics.successful_steps, 2);
    assert_eq!(metrics.failed_steps, 1);
}