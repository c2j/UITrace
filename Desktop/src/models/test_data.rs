use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestData {
    pub name: String,
    pub description: Option<String>,
    pub rows: Vec<TestDataRow>,
    pub variables: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestDataRow {
    pub id: Option<String>,
    pub data: HashMap<String, TestDataValue>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TestDataValue {
    String(String),
    Number(f64),
    Boolean(bool),
    Null,
    Object(Value),
}

impl TestDataRow {
    pub fn new() -> Self {
        Self {
            id: None,
            data: HashMap::new(),
            enabled: true,
        }
    }

    pub fn with_id(id: String) -> Self {
        Self {
            id: Some(id),
            data: HashMap::new(),
            enabled: true,
        }
    }

    pub fn add_value(&mut self, key: String, value: TestDataValue) {
        self.data.insert(key, value);
    }

    pub fn get_string(&self, key: &str) -> Option<String> {
        match self.data.get(key) {
            Some(TestDataValue::String(s)) => Some(s.clone()),
            Some(other) => Some(serde_json::to_string(other).unwrap_or_default()),
            None => None,
        }
    }
}