use uitrace_desktop::recorder::{BrowserExtension, DomEvent, ExtensionMessage};
use uitrace_desktop::models::{TestScript, TestStep};
use tokio::time::{timeout, Duration};

#[tokio::test]
async fn test_full_recording_flow() {
    // Arrange
    let (extension, mut receiver) = BrowserExtension::new();
    extension.start_recording().unwrap();

    // Simulate a user journey: Login flow
    // 1. Navigate to login page
    let nav_message = ExtensionMessage {
        message_type: "navigation".to_string(),
        data: serde_json::json!({
            "url": "https://example.com/login",
            "previousUrl": "https://example.com/"
        }),
    };
    extension.handle_extension_message(nav_message).unwrap();

    // 2. Type username
    let username_message = ExtensionMessage {
        message_type: "input".to_string(),
        data: serde_json::json!({
            "id": "username",
            "tagName": "input",
            "formData": {
                "inputType": "text",
                "value": "testuser@example.com",
                "placeholder": "Enter your username",
                "name": "username"
            }
        }),
    };
    extension.handle_extension_message(username_message).unwrap();

    // 3. Type password
    let password_message = ExtensionMessage {
        message_type: "input".to_string(),
        data: serde_json::json!({
            "id": "password",
            "tagName": "input",
            "formData": {
                "inputType": "password",
                "value": "securepassword123",
                "placeholder": "Enter your password",
                "name": "password"
            }
        }),
    };
    extension.handle_extension_message(password_message).unwrap();

    // 4. Click login button
    let login_message = ExtensionMessage {
        message_type: "click".to_string(),
        data: serde_json::json!({
            "id": "login-button",
            "tagName": "button",
            "textContent": "Log In",
            "boundingRect": {
                "x": 100.0,
                "y": 200.0,
                "width": 120.0,
                "height": 40.0
            }
        }),
    };
    extension.handle_extension_message(login_message).unwrap();

    // 5. Wait for navigation to dashboard
    let dashboard_message = ExtensionMessage {
        message_type: "navigation".to_string(),
        data: serde_json::json!({
            "url": "https://example.com/dashboard",
            "previousUrl": "https://example.com/login"
        }),
    };
    extension.handle_extension_message(dashboard_message).unwrap();

    // Act - Stop recording and get steps
    let recorded_steps = extension.stop_recording().unwrap();

    // Assert
    assert_eq!(recorded_steps.len(), 5, "Should have recorded 5 steps");

    // Verify step order and types
    assert_eq!(recorded_steps[0].action, "navigate");
    assert_eq!(recorded_steps[0].value, Some("https://example.com/login".to_string()));

    assert_eq!(recorded_steps[1].action, "type");
    assert_eq!(recorded_steps[1].value, Some("testuser@example.com".to_string()));
    assert!(recorded_steps[1].selectors.iter().any(|s| s.selector_type == "id" && s.value == "username"));

    assert_eq!(recorded_steps[2].action, "type");
    assert_eq!(recorded_steps[2].value, Some("securepassword123".to_string()));
    assert!(recorded_steps[2].selectors.iter().any(|s| s.selector_type == "id" && s.value == "password"));

    assert_eq!(recorded_steps[3].action, "click");
    assert!(recorded_steps[3].selectors.iter().any(|s| s.selector_type == "id" && s.value == "login-button"));

    assert_eq!(recorded_steps[4].action, "navigate");
    assert_eq!(recorded_steps[4].value, Some("https://example.com/dashboard".to_string()));

    // Verify step IDs are sequential
    for (i, step) in recorded_steps.iter().enumerate() {
        assert_eq!(step.step_id as usize, i + 1, "Step IDs should be sequential");
    }

    // Test that steps were sent through the channel
    let mut received_steps = Vec::new();
    while let Ok(step) = receiver.try_recv() {
        received_steps.push(step);
    }
    assert_eq!(received_steps.len(), 5, "Should have received all steps through channel");
}

#[tokio::test]
async fn test_recording_with_selectors() {
    // Arrange
    let (extension, _receiver) = BrowserExtension::new();
    extension.start_recording().unwrap();

    // Simulate clicking a button with multiple selector options
    let click_message = ExtensionMessage {
        message_type: "click".to_string(),
        data: serde_json::json!({
            "id": "search-submit",
            "tagName": "button",
            "className": "btn btn-primary search-button",
            "textContent": "Search",
            "attributes": {
                "type": "submit",
                "data-testid": "search-button"
            },
            "boundingRect": {
                "x": 250.0,
                "y": 150.0,
                "width": 100.0,
                "height": 35.0
            }
        }),
    };

    // Act
    extension.handle_extension_message(click_message).unwrap();
    let steps = extension.stop_recording().unwrap();

    // Assert
    assert_eq!(steps.len(), 1);
    let step = &steps[0];

    // Should have multiple selectors
    assert!(step.selectors.len() >= 3, "Should have at least 3 selectors");

    // Verify priority order
    assert_eq!(step.selectors[0].selector_type, "id");
    assert_eq!(step.selectors[0].value, "search-submit");
    assert_eq!(step.selectors[0].priority, 1);

    // Should have CSS selector with class
    let css_selector = step.selectors.iter()
        .find(|s| s.selector_type == "css" && s.value.contains(".btn-primary"));
    assert!(css_selector.is_some());

    // Should have XPath selector
    let xpath_selector = step.selectors.iter()
        .find(|s| s.selector_type == "xpath");
    assert!(xpath_selector.is_some());
}

#[tokio::test]
async fn test_recording_state_management() {
    // Arrange
    let (extension, _receiver) = BrowserExtension::new();

    // Act & Assert - Initial state
    assert!(!extension.is_recording(), "Should not be recording initially");

    // Start recording
    assert!(extension.start_recording().is_ok());
    assert!(extension.is_recording(), "Should be recording after start");

    // Try to start again
    assert!(extension.start_recording().is_err(), "Should not allow double start");

    // Stop recording
    assert!(extension.stop_recording().is_ok());
    assert!(!extension.is_recording(), "Should not be recording after stop");

    // Try to stop again
    assert!(extension.stop_recording().is_err(), "Should not allow double stop");
}

#[tokio::test]
async fn test_ignore_events_when_not_recording() {
    // Arrange
    let (extension, _receiver) = BrowserExtension::new();
    // Don't start recording

    // Act - Send events without recording
    let message = ExtensionMessage {
        message_type: "click".to_string(),
        data: serde_json::json!({
            "id": "test-button",
            "tagName": "button",
            "boundingRect": {
                "x": 100.0,
                "y": 200.0,
                "width": 80.0,
                "height": 30.0
            }
        }),
    };

    extension.handle_extension_message(message).unwrap();

    // Assert
    let steps = extension.get_recorded_steps();
    assert!(steps.is_empty(), "Should not record events when not recording");
}

#[tokio::test]
async fn test_clear_recorded_steps() {
    // Arrange
    let (extension, _receiver) = BrowserExtension::new();
    extension.start_recording().unwrap();

    // Record some steps
    for i in 0..3 {
        let message = ExtensionMessage {
            message_type: "click".to_string(),
            data: serde_json::json!({
                "id": &format!("button-{}", i),
                "tagName": "button",
                "boundingRect": {
                    "x": 100.0 * i as f64,
                    "y": 200.0,
                    "width": 80.0,
                    "height": 30.0
                }
            }),
        };
        extension.handle_extension_message(message).unwrap();
    }

    assert_eq!(extension.get_recorded_steps().len(), 3);

    // Act
    extension.clear_recorded_steps();

    // Assert
    assert!(extension.get_recorded_steps().is_empty(), "Steps should be cleared");
}

#[tokio::test]
async fn test_script_generation_from_recorded_steps() {
    // Arrange
    let (extension, _receiver) = BrowserExtension::new();
    extension.start_recording().unwrap();

    // Record a complete user journey
    let steps_data = vec![
        ("navigate", "https://example.com/login"),
        ("type", "testuser"),
        ("type", "password123"),
        ("click", ""),
    ];

    for (i, (action, value)) in steps_data.iter().enumerate() {
        let message = match *action {
            "navigate" => ExtensionMessage {
                message_type: "navigation".to_string(),
                data: serde_json::json!({
                    "url": value,
                    "previousUrl": ""
                }),
            },
            "type" => ExtensionMessage {
                message_type: "input".to_string(),
                data: serde_json::json!({
                    "id": &format!("{}-field", if i == 1 { "username" } else { "password" }),
                    "tagName": "input",
                    "formData": {
                        "inputType": "text",
                        "value": value,
                        "placeholder": &format!("Enter {}", if i == 1 { "username" } else { "password" }),
                    }
                }),
            },
            "click" => ExtensionMessage {
                message_type: "click".to_string(),
                data: serde_json::json!({
                    "id": "login-button",
                    "tagName": "button",
                    "textContent": "Log In",
                    "boundingRect": {
                        "x": 100.0,
                        "y": 200.0,
                        "width": 120.0,
                        "height": 40.0
                    }
                }),
            },
            _ => unreachable!(),
        };
        extension.handle_extension_message(message).unwrap();
    }

    let recorded_steps = extension.stop_recording().unwrap();

    // Act - Generate script from steps
    let mut script = TestScript::new("Login Flow".to_string(), "tester@example.com".to_string())
        .with_description("Automated login flow test".to_string());

    for step in recorded_steps {
        script = script.add_step(step);
    }

    // Assert
    assert_eq!(script.get_step_count(), 4);

    // Verify JSON serialization
    let json = script.to_json().unwrap();
    assert!(json.contains("Login Flow"));
    assert!(json.contains("navigate"));
    assert!(json.contains("type"));
    assert!(json.contains("click"));

    // Verify deserialization
    let deserialized = TestScript::from_json(&json).unwrap();
    assert_eq!(deserialized.name, script.name);
    assert_eq!(deserialized.get_step_count(), script.get_step_count());
}

#[tokio::test]
async fn test_concurrent_event_handling() {
    // Arrange
    let (extension, _receiver) = BrowserExtension::new();
    extension.start_recording().unwrap();

    // Act - Send multiple events concurrently
    let mut handles = vec![];

    for i in 0..10 {
        let ext_clone = extension.clone(); // Note: This would require Arc<BrowserExtension> in real implementation
        let handle = tokio::spawn(async move {
            let message = ExtensionMessage {
                message_type: "click".to_string(),
                data: serde_json::json!({
                    "id": &format!("button-{}", i),
                    "tagName": "button",
                    "boundingRect": {
                        "x": 100.0 * i as f64,
                        "y": 200.0,
                        "width": 80.0,
                        "height": 30.0
                    }
                }),
            };
            // In real implementation, would need proper async handling
        });
        handles.push(handle);
    }

    // Wait for all tasks (in real implementation)
    for handle in handles {
        handle.await.unwrap();
    }

    // This test demonstrates the concept - actual implementation would need
    // proper async-safe extension handling
}

#[tokio::test]
async fn test_timeout_behavior() {
    // Arrange
    let (extension, receiver) = BrowserExtension::new();
    extension.start_recording().unwrap();

    let message = ExtensionMessage {
        message_type: "click".to_string(),
        data: serde_json::json!({
            "id": "test-button",
            "tagName": "button",
            "boundingRect": {
                "x": 100.0,
                "y": 200.0,
                "width": 80.0,
                "height": 30.0
            }
        }),
    };

    // Act
    extension.handle_extension_message(message).unwrap();

    // Assert - Should receive step within timeout
    let result = timeout(Duration::from_secs(1), receiver.recv()).await;
    assert!(result.is_ok(), "Should receive step within timeout");
    assert!(result.unwrap().is_some(), "Should receive a step");
}

// Clone implementation for concurrent testing (would be needed in real implementation)
impl Clone for BrowserExtension {
    fn clone(&self) -> Self {
        // This is a simplified clone - real implementation would need proper Arc cloning
        let (sender, _) = tokio::sync::mpsc::unbounded_channel();
        Self {
            event_sender: sender,
            is_recording: Arc::new(std::sync::Mutex::new(false)),
            recorded_steps: Arc::new(std::sync::Mutex::new(Vec::new())),
        }
    }
}