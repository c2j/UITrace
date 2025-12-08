use uitrace_desktop::models::{Selector, TestStep};
use uitrace_desktop::executor::selector_fallback::SelectorFallback;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_selector_priority_sorting() {
        let mut selectors = vec![
            Selector {
                selector_type: "css".to_string(),
                value: ".button".to_string(),
                priority: 3,
            },
            Selector {
                selector_type: "id".to_string(),
                value: "#submit-btn".to_string(),
                priority: 1,
            },
            Selector {
                selector_type: "xpath".to_string(),
                value: "//button[@type='submit']".to_string(),
                priority: 2,
            },
        ];

        let fallback = SelectorFallback::new();
        fallback.sort_selectors_by_priority(&mut selectors);

        assert_eq!(selectors[0].selector_type, "id");
        assert_eq!(selectors[0].priority, 1);
        assert_eq!(selectors[1].selector_type, "xpath");
        assert_eq!(selectors[1].priority, 2);
        assert_eq!(selectors[2].selector_type, "css");
        assert_eq!(selectors[2].priority, 3);
    }

    #[test]
    fn test_selector_fallback_strategy() {
        let selectors = vec![
            Selector {
                selector_type: "id".to_string(),
                value: "#nonexistent".to_string(),
                priority: 1,
            },
            Selector {
                selector_type: "css".to_string(),
                value: ".submit-button".to_string(),
                priority: 2,
            },
            Selector {
                selector_type: "xpath".to_string(),
                value: "//button[text()='Submit']".to_string(),
                priority: 3,
            },
        ];

        let fallback = SelectorFallback::new();
        let strategy = fallback.create_fallback_strategy(selectors);

        assert_eq!(strategy.selectors.len(), 3);
        assert_eq!(strategy.current_index, 0);
        assert_eq!(strategy.max_attempts, 3);
    }

    #[test]
    fn test_selector_validation() {
        let fallback = SelectorFallback::new();

        // Valid selectors
        assert!(fallback.validate_selector(&Selector {
            selector_type: "id".to_string(),
            value: "#username".to_string(),
            priority: 1,
        }));

        assert!(fallback.validate_selector(&Selector {
            selector_type: "css".to_string(),
            value: ".button-primary".to_string(),
            priority: 2,
        }));

        // Invalid selectors
        assert!(!fallback.validate_selector(&Selector {
            selector_type: "id".to_string(),
            value: "".to_string(),
            priority: 1,
        }));

        assert!(!fallback.validate_selector(&Selector {
            selector_type: "invalid".to_string(),
            value: "#test".to_string(),
            priority: 1,
        }));
    }

    #[test]
    fn test_fallback_timeout_calculation() {
        let fallback = SelectorFallback::new();

        let base_timeout = 5000; // 5 seconds
        let retry_count = 3;

        let total_timeout = fallback.calculate_total_timeout(base_timeout, retry_count);

        // Should be base_timeout * retry_count with some buffer
        assert!(total_timeout >= base_timeout * retry_count);
        assert!(total_timeout <= base_timeout * retry_count * 2);
    }

    #[test]
    fn test_selector_specificity_scoring() {
        let fallback = SelectorFallback::new();

        // ID selectors should have highest specificity
        let id_score = fallback.calculate_specificity_score(&Selector {
            selector_type: "id".to_string(),
            value: "#unique-element".to_string(),
            priority: 1,
        });

        // CSS selectors should have medium specificity
        let css_score = fallback.calculate_specificity_score(&Selector {
            selector_type: "css".to_string(),
            value: ".button.primary".to_string(),
            priority: 2,
        });

        // Tag selectors should have lowest specificity
        let tag_score = fallback.calculate_specificity_score(&Selector {
            selector_type: "tag".to_string(),
            value: "button".to_string(),
            priority: 5,
        });

        assert!(id_score > css_score);
        assert!(css_score > tag_score);
    }

    #[test]
    fn test_fallback_strategy_with_step() {
        let step = TestStep::new(1, "Click submit button".to_string(), "click".to_string())
            .add_selector("id".to_string(), "#submit".to_string(), 1)
            .add_selector("css".to_string(), ".submit-btn".to_string(), 2)
            .add_selector("xpath".to_string(), "//button[@type='submit']".to_string(), 3);

        let fallback = SelectorFallback::new();
        let strategy = fallback.create_fallback_strategy_for_step(&step);

        assert_eq!(strategy.selectors.len(), 3);
        assert_eq!(strategy.current_index, 0);

        // Verify selectors are sorted by priority
        assert_eq!(strategy.selectors[0].priority, 1);
        assert_eq!(strategy.selectors[1].priority, 2);
        assert_eq!(strategy.selectors[2].priority, 3);
    }

    #[test]
    fn test_retry_delay_calculation() {
        let fallback = SelectorFallback::new();

        // Test exponential backoff
        let delay1 = fallback.calculate_retry_delay(1, 1000);
        let delay2 = fallback.calculate_retry_delay(2, 1000);
        let delay3 = fallback.calculate_retry_delay(3, 1000);

        assert!(delay2 > delay1);
        assert!(delay3 > delay2);

        // Test maximum delay cap
        let delay10 = fallback.calculate_retry_delay(10, 1000);
        assert!(delay10 <= 30000); // Max 30 seconds
    }
}