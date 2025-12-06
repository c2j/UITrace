use crate::models::{TestData, TestDataRow};
use crate::test_data::TestDataValue;
use crate::utils::error_handler::UITraceError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
struct JsonTestData {
    name: String,
    description: Option<String>,
    rows: Vec<JsonTestRow>,
    variables: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonTestRow {
    id: Option<String>,
    data: HashMap<String, serde_json::Value>,
    enabled: Option<bool>,
}

pub struct JsonParser;

impl JsonParser {
    pub fn new() -> Self {
        Self
    }

    pub async fn parse(&self, path: &Path) -> Result<TestData, UITraceError> {
        let content = tokio::fs::read_to_string(path).await?;
        let json_data: JsonTestData = serde_json::from_str(&content)?;

        let mut rows = Vec::new();
        for row in json_data.rows {
            let mut test_row = TestDataRow {
                id: row.id,
                data: HashMap::new(),
                enabled: row.enabled.unwrap_or(true),
            };

            for (key, value) in row.data {
                let test_value = match value {
                    serde_json::Value::String(s) => TestDataValue::String(s),
                    serde_json::Value::Number(n) => TestDataValue::Number(n.as_f64().unwrap_or(0.0)),
                    serde_json::Value::Bool(b) => TestDataValue::Boolean(b),
                    serde_json::Value::Null => TestDataValue::Null,
                    other => TestDataValue::Object(other),
                };
                test_row.data.insert(key, test_value);
            }

            rows.push(test_row);
        }

        Ok(TestData {
            name: json_data.name,
            description: json_data.description,
            rows,
            variables: json_data.variables,
        })
    }

    pub async fn save(&self, data: &TestData, output_path: &Path) -> Result<(), UITraceError> {
        let mut json_rows = Vec::new();

        for row in &data.rows {
            let mut json_data = HashMap::new();
            for (key, value) in &row.data {
                let json_value = match value {
                    TestDataValue::String(s) => serde_json::Value::String(s.clone()),
                    TestDataValue::Number(n) => serde_json::Value::Number(
                        serde_json::Number::from_f64(*n)
                            .ok_or_else(|| UITraceError::Data("Invalid number value".to_string()))?,
                    ),
                    TestDataValue::Boolean(b) => serde_json::Value::Bool(*b),
                    TestDataValue::Null => serde_json::Value::Null,
                    TestDataValue::Object(obj) => obj.clone(),
                };
                json_data.insert(key.clone(), json_value);
            }

            json_rows.push(JsonTestRow {
                id: row.id.clone(),
                data: json_data,
                enabled: Some(row.enabled),
            });
        }

        let json_data = JsonTestData {
            name: data.name.clone(),
            description: data.description.clone(),
            rows: json_rows,
            variables: data.variables.clone(),
        };

        let content = serde_json::to_string_pretty(&json_data)?;
        tokio::fs::write(output_path, content).await?;

        Ok(())
    }
}

impl Default for JsonParser {
    fn default() -> Self {
        Self::new()
    }
}