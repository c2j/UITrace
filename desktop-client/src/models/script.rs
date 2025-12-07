use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::models::step::{Selector, StepAction};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestStep {
    pub step_id: i32,
    pub name: String,
    pub action: StepAction,
    pub value: Option<String>,
    pub expected_value: Option<String>,
    pub timeout_seconds: i32,
    pub retry_count: i32,
    pub selectors: Vec<Selector>,
    pub data_source: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestScript {
    pub id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub author_id: Uuid,
    pub project_id: Option<Uuid>,
    pub tags: Vec<String>,
    pub status: String,
    pub steps: Vec<TestStep>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl TestScript {
    pub fn new(name: String, author_id: Uuid) -> Self {
        Self {
            id: None,
            name,
            description: None,
            version: "1.0.0".to_string(),
            author_id,
            project_id: None,
            tags: Vec::new(),
            status: "draft".to_string(),
            steps: Vec::new(),
            created_at: None,
            updated_at: None,
        }
    }

    pub fn add_step(&mut self, step: TestStep) {
        self.steps.push(step);
    }

    pub fn get_placeholder_variables(&self) -> Vec<String> {
        let mut variables = Vec::new();
        for step in &self.steps {
            if let Some(ref value) = step.value {
                Self::extract_placeholders(value, &mut variables);
            }
            if let Some(ref expected_value) = step.expected_value {
                Self::extract_placeholders(expected_value, &mut variables);
            }
        }
        variables
    }

    fn extract_placeholders(text: &str, variables: &mut Vec<String>) {
        // Simple regex to find ${variable} patterns
        let placeholder_pattern = regex::Regex::new(r"\$\{([^}]+)\}").unwrap();
        for captures in placeholder_pattern.captures_iter(text) {
            if let Some(variable) = captures.get(1) {
                let placeholder = format!("${{{}}}", variable.as_str());
                if !variables.iter().any(|v| v == &placeholder) {
                    variables.push(variable.as_str().to_string());
                }
            }
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.name.is_empty() {
            return Err("Script name cannot be empty".to_string());
        }

        if self.steps.is_empty() {
            return Err("Script must have at least one step".to_string());
        }

        for (index, step) in self.steps.iter().enumerate() {
            if step.name.is_empty() {
                return Err(format!("Step {} name cannot be empty", index + 1));
            }

            // StepAction validation - ensure it's a valid action
            // We don't need is_empty() for enum since it's always a valid variant

            if step.selectors.is_empty() {
                return Err(format!("Step {} must have at least one selector", index + 1));
            }

            if step.timeout_seconds <= 0 {
                return Err(format!("Step {} timeout must be positive", index + 1));
            }
        }

        Ok(())
    }
}