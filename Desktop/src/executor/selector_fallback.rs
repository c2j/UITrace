use crate::models::Selector;
use std::collections::HashMap;
use log::{debug, warn, info};

/// Strategy for selector fallback execution
#[derive(Debug, Clone)]
pub struct FallbackStrategy {
    pub selectors: Vec<Selector>,
    pub current_index: usize,
    pub max_attempts: u32,
}

impl FallbackStrategy {
    pub fn new(selectors: Vec<Selector>) -> Self {
        Self {
            selectors,
            current_index: 0,
            max_attempts: 3,
        }
    }

    /// Get the next selector to try
    pub fn next_selector(&mut self) -> Option<&Selector> {
        if self.current_index < self.selectors.len() {
            let selector = &self.selectors[self.current_index];
            self.current_index += 1;
            Some(selector)
        } else {
            None
        }
    }

    /// Check if there are more selectors to try
    pub fn has_more_selectors(&self) -> bool {
        self.current_index < self.selectors.len()
    }

    /// Reset to the beginning
    pub fn reset(&mut self) {
        self.current_index = 0;
    }
}

/// Selector fallback engine with multiple strategies
pub struct SelectorFallback {
    strategies: HashMap<String, FallbackStrategy>,
}

impl SelectorFallback {
    pub fn new() -> Self {
        Self {
            strategies: HashMap::new(),
        }
    }

    /// Create a fallback strategy from selectors
    pub fn create_fallback_strategy(&mut self,
        selectors: Vec<Selector>,
    ) -> FallbackStrategy {
        let mut sorted_selectors = selectors;
        sorted_selectors.sort_by_key(|s| s.priority);

        let strategy = FallbackStrategy::new(sorted_selectors);
        let strategy_id = uuid::Uuid::new_v4().to_string();
        self.strategies.insert(strategy_id.clone(), strategy.clone());

        strategy
    }

    /// Create a fallback strategy for a specific test step
    pub fn create_fallback_strategy_for_step(
        &mut self,
        step: &crate::models::TestStep,
    ) -> FallbackStrategy {
        self.create_fallback_strategy(step.selectors.clone())
    }

    /// Sort selectors by priority
    pub fn sort_selectors_by_priority(&self,
        selectors: &mut Vec<Selector>,
    ) {
        selectors.sort_by_key(|s| s.priority);
    }

    /// Validate a selector
    pub fn validate_selector(&self,
        selector: &Selector,
    ) -> bool {
        if selector.value.trim().is_empty() {
            return false;
        }

        match selector.selector_type.as_str() {
            "id" | "css" | "xpath" | "link_text" | "partial_link_text" |
            "tag" | "class" | "name" => true,
            _ => false,
        }
    }

    /// Calculate total timeout for all retry attempts
    pub fn calculate_total_timeout(
        &self,
        base_timeout: u64,
        retry_count: u32,
    ) -> u64 {
        // Calculate total time including retry delays
        let mut total_time = base_timeout * retry_count as u64;

        // Add time for retry delays (exponential backoff)
        for i in 1..retry_count {
            let delay = base_timeout * 2_u64.pow(i);
            total_time += delay.min(base_timeout * 5); // Cap individual delay
        }

        total_time
    }

    /// Calculate specificity score for a selector
    pub fn calculate_specificity_score(&self,
        selector: &Selector,
    ) -> u32 {
        let type_score = match selector.selector_type.as_str() {
            "id" => 100,
            "css" => 50,
            "xpath" => 30,
            "link_text" | "partial_link_text" => 20,
            "class" => 15,
            "name" => 10,
            "tag" => 5,
            _ => 0,
        };

        let complexity_score = match selector.selector_type.as_str() {
            "css" => {
                if selector.value.contains('#') { 50 } // Has ID
                else if selector.value.contains('.') { 30 } // Has class
                else { 20 }
            },
            "xpath" => {
                if selector.value.contains("@id=") { 40 }
                else if selector.value.contains("@class=") { 25 }
                else { 15 }
            },
            _ => 10,
        };

        type_score + complexity_score
    }

    /// Calculate retry delay with exponential backoff
    pub fn calculate_retry_delay(
        &self,
        attempt: u32,
        base_delay: u64,
    ) -> u64 {
        if attempt == 0 {
            return 0;
        }

        let delay = base_delay * 2_u64.pow(attempt.saturating_sub(1));
        delay.min(base_delay * 10) // Cap at 10x base delay
    }

    /// Get detailed information about selector failures
    pub fn get_failure_info(&self,
        selectors: &[Selector],
    ) -> SelectorFailureInfo {
        let mut info = SelectorFailureInfo {
            total_selectors: selectors.len(),
            prioritized_selectors: Vec::new(),
            recommended_actions: Vec::new(),
        };

        // Create a copy and sort by priority
        let mut sorted_selectors = selectors.to_vec();
        self.sort_selectors_by_priority(&mut sorted_selectors);

        for selector in &sorted_selectors {
            info.prioritized_selectors.push(format!(
                "{} (priority: {}, type: {})",
                selector.value,
                selector.priority,
                selector.selector_type
            ));
        }

        // Analyze selector coverage and provide recommendations
        let selector_types: Vec<&str> = selectors.iter()
            .map(|s| s.selector_type.as_str())
            .collect();

        if !selector_types.contains(&"id") {
            info.recommended_actions.push(
                "Consider adding an ID selector if the element has a unique ID".to_string()
            );
        }

        if !selector_types.contains(&"css") && selector_types.contains(&"xpath") {
            info.recommended_actions.push(
                "Consider adding CSS selectors as they are generally faster than XPath".to_string()
            );
        }

        if selectors.is_empty() {
            info.recommended_actions.push(
                "No selectors provided - add at least one selector strategy".to_string()
            );
        }

        // Check for overly generic selectors
        let generic_selectors = selectors.iter()
            .filter(|s| {
                matches!(s.selector_type.as_str(), "tag" | "class") &&
                s.value.len() < 3
            })
            .count();

        if generic_selectors > 0 {
            info.recommended_actions.push(format!(
                "{} selectors appear overly generic - consider more specific selectors",
                generic_selectors
            ));
        }

        info
    }
}

/// Information about selector failures
#[derive(Debug, Clone)]
pub struct SelectorFailureInfo {
    pub total_selectors: usize,
    pub prioritized_selectors: Vec<String>,
    pub recommended_actions: Vec<String>,
}

impl SelectorFailureInfo {
    pub fn new() -> Self {
        Self {
            total_selectors: 0,
            prioritized_selectors: Vec::new(),
            recommended_actions: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Selector;

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
    fn test_fallback_strategy_creation() {
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

        let mut fallback = SelectorFallback::new();
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
    fn test_total_timeout_calculation() {
        let fallback = SelectorFallback::new();

        let base_timeout = 5000; // 5 seconds
        let retry_count = 3;

        let total_timeout = fallback.calculate_total_timeout(base_timeout, retry_count);

        // Should be greater than base timeout * retry count due to retry delays
        assert!(total_timeout >= base_timeout * retry_count as u64);
    }

    #[test]
    fn test_specificity_scoring() {
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
    fn test_retry_delay_calculation() {
        let fallback = SelectorFallback::new();

        let base_delay = 1000; // 1 second

        let delay1 = fallback.calculate_retry_delay(1, base_delay);
        let delay2 = fallback.calculate_retry_delay(2, base_delay);
        let delay3 = fallback.calculate_retry_delay(3, base_delay);

        // Exponential backoff: 1s, 2s, 4s
        assert_eq!(delay1, 1000);
        assert_eq!(delay2, 2000);
        assert_eq!(delay3, 4000);

        // Test maximum cap
        let delay10 = fallback.calculate_retry_delay(10, base_delay);
        assert_eq!(delay10, 10000); // Capped at 10x base delay
    }

    #[test]
    fn test_failure_info_generation() {
        let selectors = vec![
            Selector {
                selector_type: "xpath".to_string(),
                value: "//div[@class='test']".to_string(),
                priority: 3,
            },
            Selector {
                selector_type: "id".to_string(),
                value: "test-id".to_string(),
                priority: 1,
            },
            Selector {
                selector_type: "css".to_string(),
                value: ".test-class".to_string(),
                priority: 2,
            },
        ];

        let fallback = SelectorFallback::new();
        let info = fallback.get_failure_info(&selectors);

        assert_eq!(info.total_selectors, 3);
        assert_eq!(info.prioritized_selectors.len(), 3);
        assert_eq!(info.prioritized_selectors[0], "test-id (priority: 1, type: id)");
        assert_eq!(info.prioritized_selectors[1], ".test-class (priority: 2, type: css)");
        assert_eq!(info.prioritized_selectors[2], "//div[@class='test'] (priority: 3, type: xpath)");

        // Should have recommendations
        assert!(info.recommended_actions.len() > 0);
    }

    #[test]
    fn test_fallback_strategy_with_step() {
        let step = crate::models::TestStep::new(1, "Test step".to_string(), "click".to_string())
            .add_selector("id".to_string(), "#submit".to_string(), 1)
            .add_selector("css".to_string(), ".submit-btn".to_string(), 2)
            .add_selector("xpath".to_string(), "//button[@type='submit']".to_string(), 3);

        let mut fallback = SelectorFallback::new();
        let strategy = fallback.create_fallback_strategy_for_step(&step);

        assert_eq!(strategy.selectors.len(), 3);
        assert_eq!(strategy.current_index, 0);

        // Verify selectors are sorted by priority
        assert_eq!(strategy.selectors[0].priority, 1);
        assert_eq!(strategy.selectors[1].priority, 2);
        assert_eq!(strategy.selectors[2].priority, 3);
    }

    #[test]
    fn test_fallback_strategy_iteration() {
        let selectors = vec![
            Selector {
                selector_type: "id".to_string(),
                value: "#test1".to_string(),
                priority: 1,
            },
            Selector {
                selector_type: "css".to_string(),
                value: ".test2".to_string(),
                priority: 2,
            },
        ];

        let mut fallback = SelectorFallback::new();
        let mut strategy = fallback.create_fallback_strategy(selectors);

        // First selector
        assert!(strategy.next_selector().is_some());
        assert_eq!(strategy.current_index, 1);

        // Second selector
        assert!(strategy.next_selector().is_some());
        assert_eq!(strategy.current_index, 2);

        // No more selectors
        assert!(strategy.next_selector().is_none());
        assert!(!strategy.has_more_selectors());

        // Reset
        strategy.reset();
        assert_eq!(strategy.current_index, 0);
        assert!(strategy.has_more_selectors());
    }
}

// Re-export for convenience
pub use SelectorFallback;