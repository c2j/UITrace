use uitrace_desktop::recorder::event_capture::{EventCapture, DomEvent};
use uitrace_desktop::models::test_step::TestStep;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_click_event() {
        // Arrange
        let event = DomEvent::Click {
            element_id: Some("submit-button".to_string()),
            element_tag: "button".to_string(),
            element_text: Some("Submit".to_string()),
            coordinates: (100, 200),
        };

        // Act
        let captured_step = EventCapture::capture_event(event).unwrap();

        // Assert
        assert_eq!(captured_step.action, "click");
        assert!(captured_step.selectors.iter().any(|s| s.selector_type == "id" && s.value == "submit-button"));
        assert!(captured_step.selectors.iter().any(|s| s.selector_type == "css" && s.value == "button"));
    }

    #[test]
    fn test_capture_type_event() {
        // Arrange
        let event = DomEvent::Type {
            element_id: Some("username-field".to_string()),
            element_tag: "input".to_string(),
            input_type: Some("text".to_string()),
            value: "testuser@example.com".to_string(),
        };

        // Act
        let captured_step = EventCapture::capture_event(event).unwrap();

        // Assert
        assert_eq!(captured_step.action, "type");
        assert_eq!(captured_step.value, Some("testuser@example.com".to_string()));
        assert!(captured_step.selectors.iter().any(|s| s.selector_type == "id"));
    }

    #[test]
    fn test_capture_navigation_event() {
        // Arrange
        let event = DomEvent::Navigation {
            url: "https://example.com/dashboard".to_string(),
            previous_url: "https://example.com/login".to_string(),
        };

        // Act
        let captured_step = EventCapture::capture_event(event).unwrap();

        // Assert
        assert_eq!(captured_step.action, "navigate");
        assert_eq!(captured_step.value, Some("https://example.com/dashboard".to_string()));
    }

    #[test]
    fn test_generate_multiple_selectors() {
        // Arrange
        let event = DomEvent::Click {
            element_id: Some("search-box".to_string()),
            element_tag: "div".to_string(),
            element_text: Some("Search".to_string()),
            coordinates: (150, 300),
        };

        // Act
        let captured_step = EventCapture::capture_event(event).unwrap();

        // Assert
        assert!(captured_step.selectors.len() >= 3, "Should generate at least 3 selectors");

        // Check for ID selector
        assert!(captured_step.selectors.iter().any(|s| s.selector_type == "id" && s.value == "search-box"));

        // Check for CSS selector based on tag
        assert!(captured_step.selectors.iter().any(|s| s.selector_type == "css" && s.value.contains("div")));

        // Check for XPath selector
        assert!(captured_step.selectors.iter().any(|s| s.selector_type == "xpath"));
    }

    #[test]
    fn test_handle_element_without_id() {
        // Arrange
        let event = DomEvent::Click {
            element_id: None,
            element_tag: "button".to_string(),
            element_text: Some("Click Me".to_string()),
            coordinates: (200, 400),
        };

        // Act
        let captured_step = EventCapture::capture_event(event).unwrap();

        // Assert
        assert!(captured_step.selectors.len() >= 2, "Should generate selectors even without ID");
        assert!(!captured_step.selectors.iter().any(|s| s.selector_type == "id" && s.value.is_empty()));

        // Should have CSS and XPath selectors
        assert!(captured_step.selectors.iter().any(|s| s.selector_type == "css"));
        assert!(captured_step.selectors.iter().any(|s| s.selector_type == "xpath"));
    }

    #[test]
    fn test_event_with_custom_attributes() {
        // Arrange
        let event = DomEvent::Click {
            element_id: Some("login-form".to_string()),
            element_tag: "form".to_string(),
            element_text: None,
            coordinates: (50, 100),
        };

        // Act
        let captured_step = EventCapture::capture_event(event).unwrap();

        // Assert
        assert_eq!(captured_step.action, "click");
        assert!(captured_step.selectors.iter().any(|s| s.selector_type == "id"));
        assert!(captured_step.metadata.contains_key("coordinates"));
    }

    #[test]
    fn test_invalid_event_handling() {
        // Arrange
        let event = DomEvent::Type {
            element_id: None,
            element_tag: "".to_string(), // Invalid empty tag
            input_type: None,
            value: "".to_string(),
        };

        // Act
        let result = EventCapture::capture_event(event);

        // Assert
        assert!(result.is_err(), "Should return error for invalid event");
    }

    #[test]
    fn test_event_metadata_inclusion() {
        // Arrange
        let event = DomEvent::Click {
            element_id: Some("button-1".to_string()),
            element_tag: "button".to_string(),
            element_text: Some("Submit Form".to_string()),
            coordinates: (300, 450),
        };

        // Act
        let captured_step = EventCapture::capture_event(event).unwrap();

        // Assert
        assert!(captured_step.metadata.contains_key("element_text"));
        assert!(captured_step.metadata.contains_key("coordinates"));
        assert_eq!(captured_step.metadata.get("element_tag"), Some(&"button".to_string()));
    }
}