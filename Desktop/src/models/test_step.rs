use serde::{Deserialize, Serialize};
use crate::models::selector::Selector;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestStep {
    pub step_id: u32,
    pub name: String,
    pub step_type: String,
    pub action: String,
    pub description: String,
    pub value: Option<String>,
    pub expected_value: Option<String>,
    pub timeout_seconds: u32,
    pub selectors: Vec<Selector>,
    pub metadata: HashMap<String, String>,
}

impl TestStep {
    pub fn new(step_id: u32, name: String, action: String) -> Self {
        Self {
            step_id,
            name,
            step_type: "action".to_string(),
            action,
            description: String::new(),
            value: None,
            expected_value: None,
            timeout_seconds: 30,
            selectors: Vec::new(),
            metadata: HashMap::new(),
        }
    }

    pub fn with_value(mut self, value: String) -> Self {
        self.value = Some(value);
        self
    }

    pub fn with_timeout(mut self, timeout: u32) -> Self {
        self.timeout_seconds = timeout;
        self
    }

    pub fn add_selector(mut self, selector_type: String, value: String, priority: u32) -> Self {
        self.selectors.push(Selector {
            selector_type,
            value,
            priority,
        });
        self
    }

    pub fn add_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}