use uitrace_desktop::recorder::SelectorGenerator;
use uitrace_desktop::recorder::ElementInfo;
use uitrace_desktop::models::Selector;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_id_selector_generation() {
        // Arrange
        let element = ElementInfo::new("button".to_string())
            .with_id("submit-btn".to_string());

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(selectors.iter().any(|s| s.selector_type == "id" && s.value == "submit-btn"));
        assert_eq!(selectors[0].selector_type, "id", "ID selector should have highest priority");
    }

    #[test]
    fn test_name_selector_generation() {
        // Arrange
        let element = ElementInfo::new("input".to_string())
            .with_name("username".to_string());

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(selectors.iter().any(|s| s.selector_type == "name" && s.value == "username"));
    }

    #[test]
    fn test_class_selector_generation() {
        // Arrange
        let element = ElementInfo::new("div".to_string())
            .with_class("form-group container".to_string());

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        let css_selectors: Vec<&Selector> = selectors.iter()
            .filter(|s| s.selector_type == "css")
            .collect();

        assert!(css_selectors.iter().any(|s| s.value.contains(".form-group")));
        assert!(css_selectors.iter().any(|s| s.value.contains(".container")));
        assert!(css_selectors.iter().any(|s| s.value == "div.form-group.container"));
    }

    #[test]
    fn test_link_text_selector_generation() {
        // Arrange
        let element = ElementInfo::new("a".to_string())
            .with_text("Click here to continue".to_string());

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(selectors.iter().any(|s| s.selector_type == "link_text" && s.value == "Click here to continue"));
        assert!(selectors.iter().any(|s| s.selector_type == "partial_link_text" && s.value == "Click here to continue"));
    }

    #[test]
    fn test_xpath_selector_generation() {
        // Arrange
        let element = ElementInfo::new("button".to_string())
            .with_id("save-btn".to_string())
            .with_class("btn-primary".to_string());

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(selectors.iter().any(|s| s.selector_type == "xpath" && s.value.contains("//button[@id='save-btn']")));
        assert!(selectors.iter().any(|s| s.selector_type == "xpath" && s.value.contains("contains(@class") && s.value.contains("btn-primary")));
    }

    #[test]
    fn test_selector_priority_ordering() {
        // Arrange
        let element = ElementInfo::new("input".to_string())
            .with_id("email-field".to_string())
            .with_name("email".to_string())
            .with_class("form-control".to_string());

        // Act
        let mut selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(selectors.len() >= 5, "Should generate multiple selectors");

        // Sort by priority to verify order
        selectors.sort_by_key(|s| s.priority);

        // ID should be first (priority 1)
        assert_eq!(selectors[0].selector_type, "id");

        // Name should be second (priority 2)
        let name_selector = selectors.iter().find(|s| s.selector_type == "name");
        assert!(name_selector.is_some());
        assert_eq!(name_selector.unwrap().priority, 2);
    }

    #[test]
    fn test_selector_optimization_removes_duplicates() {
        // Arrange
        let mut selectors = vec![
            Selector::new("css".to_string(), "button.btn".to_string(), 1),
            Selector::new("css".to_string(), "button.btn".to_string(), 2), // Duplicate
            Selector::new("id".to_string(), "submit-btn".to_string(), 3),
            Selector::new("css".to_string(), "button.btn".to_string(), 4), // Another duplicate
            Selector::new("xpath".to_string(), "//button".to_string(), 5),
        ];

        // Act
        SelectorGenerator::optimize_selectors(&mut selectors);

        // Assert
        assert_eq!(selectors.len(), 3, "Should remove duplicates");

        // Verify unique selectors remain
        let unique_combinations: std::collections::HashSet<(&String, &String)> = selectors.iter()
            .map(|s| (&s.selector_type, &s.value))
            .collect();
        assert_eq!(unique_combinations.len(), 3, "All remaining selectors should be unique");
    }

    #[test]
    fn test_selector_scoring_system() {
        // Arrange
        let element = ElementInfo::new("button".to_string())
            .with_id("unique-btn".to_string());

        let id_selector = Selector::new("id".to_string(), "unique-btn".to_string(), 1);
        let css_selector = Selector::new("css".to_string(), "button#unique-btn".to_string(), 2);
        let tag_selector = Selector::new("tag".to_string(), "button".to_string(), 6);

        // Act
        let id_score = SelectorGenerator::score_selector(&id_selector, &element);
        let css_score = SelectorGenerator::score_selector(&css_selector, &element);
        let tag_score = SelectorGenerator::score_selector(&tag_selector, &element);

        // Assert
        assert!(id_score > css_score, "ID selector should score higher than CSS selector");
        assert!(css_score > tag_score, "CSS selector should score higher than tag selector");
    }

    #[test]
    fn test_invalid_id_handling() {
        // Arrange - Test various invalid IDs
        let test_cases = vec![
            ("123invalid", false), // Starts with number
            ("", false),           // Empty
            ("my id", false),      // Contains space
            ("valid-id_123", true), // Valid
        ];

        for (id, expected_valid) in test_cases {
            let element = ElementInfo::new("div".to_string())
                .with_id(id.to_string());

            let selectors = SelectorGenerator::generate_selectors(&element);
            let has_id_selector = selectors.iter().any(|s| s.selector_type == "id");

            assert_eq!(has_id_selector, expected_valid,
                "ID '{}' should {}be included in selectors",
                id,
                if expected_valid { "" } else { "not " });
        }
    }

    #[test]
    fn test_complex_element_selectors() {
        // Arrange - Complex element with multiple attributes
        let element = ElementInfo::new("input".to_string())
            .with_id("email-input".to_string())
            .with_name("userEmail".to_string())
            .with_class("form-control email-field".to_string())
            .with_placeholder("Enter your email".to_string());

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(selectors.iter().any(|s| s.selector_type == "id" && s.value == "email-input"));
        assert!(selectors.iter().any(|s| s.selector_type == "name" && s.value == "userEmail"));

        // Should have complex CSS selector with all attributes
        let complex_css = selectors.iter()
            .find(|s| s.selector_type == "css" && s.value.contains("#email-input"));
        assert!(complex_css.is_some());
        assert!(complex_css.unwrap().value.contains(".form-control"));
        assert!(complex_css.unwrap().value.contains("[name='userEmail']"));
    }

    #[test]
    fn test_element_index_in_xpath() {
        // Arrange
        let element = ElementInfo::new("button".to_string())
            .with_index(3);

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(selectors.iter().any(|s| s.selector_type == "xpath" && s.value == "//button[4]"));
    }

    #[test]
    fn test_placeholder_attribute_selector() {
        // Arrange
        let element = ElementInfo::new("input".to_string())
            .with_placeholder("Search...".to_string());

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(selectors.iter().any(|s| s.selector_type == "css" && s.value.contains("[placeholder='Search...']")));
    }

    #[test]
    fn test_alt_text_attribute_selector() {
        // Arrange
        let element = ElementInfo::new("img".to_string())
            .with_alt_text("Company logo".to_string());

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(selectors.iter().any(|s| s.selector_type == "css" && s.value.contains("[alt='Company logo']")));
    }

    #[test]
    fn test_selector_limiting() {
        // Arrange - Create element that would generate many selectors
        let element = ElementInfo::new("a".to_string())
            .with_id("link-id".to_string())
            .with_name("link-name".to_string())
            .with_class("link-class".to_string())
            .with_text("Link Text".to_string())
            .with_placeholder("placeholder".to_string())
            .with_alt_text("alt text".to_string())
            .with_index(5);

        // Act
        let mut selectors = SelectorGenerator::generate_selectors(&element);
        SelectorGenerator::optimize_selectors(&mut selectors);

        // Assert
        assert!(selectors.len() <= 5, "Should limit to 5 selectors max");
    }

    #[test]
    fn test_empty_or_invalid_values_ignored() {
        // Arrange
        let element = ElementInfo::new("div".to_string())
            .with_id("".to_string()) // Empty ID
            .with_name("test\"name".to_string()) // Name with quotes
            .with_class("class with\"quotes".to_string()) // Class with quotes
            .with_text("".to_string()); // Empty text

        // Act
        let selectors = SelectorGenerator::generate_selectors(&element);

        // Assert
        assert!(!selectors.iter().any(|s| s.selector_type == "id"), "Empty ID should be ignored");
        assert!(!selectors.iter().any(|s| s.selector_type == "name"), "Name with quotes should be ignored");
        assert!(!selectors.iter().any(|s| s.selector_type == "link_text"), "Empty text should be ignored");
    }
}

// Include the test module
pub mod selector_test;