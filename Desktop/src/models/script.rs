use serde::{Deserialize, Serialize};
use crate::models::TestStep;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestScript {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
    pub created_by: String,
    pub tags: Vec<String>,
    pub steps: Vec<TestStep>,
    pub metadata: serde_json::Value,
}

impl TestScript {
    pub fn new(name: String, created_by: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            description: None,
            version: "1.0.0".to_string(),
            created_at: now.clone(),
            updated_at: now,
            created_by,
            tags: Vec::new(),
            steps: Vec::new(),
            metadata: serde_json::Value::Object(serde_json::Map::new()),
        }
    }

    pub fn with_description(mut self, description: String) -> Self {
        self.description = Some(description);
        self
    }

    pub fn add_step(mut self, step: TestStep) -> Self {
        self.steps.push(step);
        self
    }

    pub fn add_tag(mut self, tag: String) -> Self {
        self.tags.push(tag);
        self
    }

    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    pub fn update_timestamp(mut self) -> Self {
        self.updated_at = chrono::Utc::now().to_rfc3339();
        self
    }

    pub fn get_step_count(&self) -> usize {
        self.steps.len()
    }

    pub fn get_average_timeout(&self) -> u32 {
        if self.steps.is_empty() {
            return 30;
        }

        let total_timeout: u32 = self.steps.iter().map(|s| s.timeout_seconds).sum();
        total_timeout / self.steps.len() as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TestStep;

    #[test]
    fn test_script_creation() {
        let script = TestScript::new("Login Test".to_string(), "tester@example.com".to_string());

        assert_eq!(script.name, "Login Test");
        assert_eq!(script.created_by, "tester@example.com");
        assert_eq!(script.version, "1.0.0");
        assert!(script.description.is_none());
        assert!(script.steps.is_empty());
    }

    #[test]
    fn test_script_serialization() {
        let script = TestScript::new("Test Script".to_string(), "user@example.com".to_string())
            .with_description("A test script".to_string())
            .add_tag("login".to_string());

        let json = script.to_json().unwrap();
        let deserialized = TestScript::from_json(&json).unwrap();

        assert_eq!(deserialized.name, script.name);
        assert_eq!(deserialized.description, script.description);
        assert_eq!(deserialized.tags, script.tags);
    }

    #[test]
    fn test_script_with_steps() {
        let step1 = TestStep::new(1, "Navigate to login".to_string(), "navigate".to_string())
            .with_value("https://example.com/login".to_string());

        let step2 = TestStep::new(2, "Enter username".to_string(), "type".to_string())
            .with_value("testuser".to_string());

        let script = TestScript::new("Login Flow".to_string(), "tester@example.com".to_string())
            .add_step(step1)
            .add_step(step2);

        assert_eq!(script.get_step_count(), 2);
        assert_eq!(script.steps[0].action, "navigate");
        assert_eq!(script.steps[1].action, "type");
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptMetadata {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub created_by: String,
    pub step_count: usize,
    pub average_timeout: u32,
}

impl From<&TestScript> for ScriptMetadata {
    fn from(script: &TestScript) -> Self {
        Self {
            id: script.id.clone(),
            name: script.name.clone(),
            description: script.description.clone(),
            version: script.version.clone(),
            tags: script.tags.clone(),
            created_at: script.created_at.clone(),
            updated_at: script.updated_at.clone(),
            created_by: script.created_by.clone(),
            step_count: script.get_step_count(),
            average_timeout: script.get_average_timeout(),
        }
    }
}