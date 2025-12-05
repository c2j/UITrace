use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestScript {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub version: i32,
    pub steps: Vec<TestStep>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestStep {
    pub step_id: i32,
    pub name: String,
    pub action: StepAction,
    pub selectors: Vec<ElementSelector>,
    pub value: Option<String>,
    pub expected_value: Option<String>,
    pub timeout_seconds: u32,
    pub screenshot: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepAction {
    Navigate,
    Click,
    Type,
    AssertText,
    AssertUrl,
    Screenshot,
    Wait,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementSelector {
    pub selector_type: SelectorType,
    pub value: String,
    pub priority: u8, // 1-5, lower is higher priority
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SelectorType {
    Id,
    Css,
    XPath,
    Name,
    DataAttribute,
}

impl TestScript {
    pub fn new(name: String, description: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            description,
            version: 1,
            steps: Vec::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    pub fn add_step(&mut self, step: TestStep) {
        self.steps.push(step);
        self.updated_at = Utc::now();
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.steps.is_empty() {
            return Err("Script must have at least one step".to_string());
        }

        for (i, step) in self.steps.iter().enumerate() {
            if step.selectors.is_empty() && !matches!(step.action, StepAction::Navigate | StepAction::Wait) {
                return Err(format!("Step {} must have at least one selector", i + 1));
            }
        }

        Ok(())
    }
}