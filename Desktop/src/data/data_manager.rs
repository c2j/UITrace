use crate::data::sources::DataSource;
use crate::data::{CsvParser, ExcelParser, JsonParser};
use crate::models::{TestData, TestDataRow};
use crate::utils::error_handler::UITraceError;
use std::collections::HashMap;

pub struct DataManager {
    csv_parser: CsvParser,
    excel_parser: ExcelParser,
    json_parser: JsonParser,
}

impl DataManager {
    pub fn new() -> Self {
        Self {
            csv_parser: CsvParser::new(),
            excel_parser: ExcelParser::new(),
            json_parser: JsonParser::new(),
        }
    }

    pub async fn load_test_data(&self, source: DataSource) -> Result<TestData, UITraceError> {
        match source {
            DataSource::Csv(path) => self.csv_parser.parse(&path).await,
            DataSource::Excel(path) => self.excel_parser.parse(&path).await,
            DataSource::Json(path) => self.json_parser.parse(&path).await,
        }
    }

    pub async fn save_as_csv(&self, data: &TestData, output_path: &std::path::Path) -> Result<(), UITraceError> {
        self.csv_parser.save(data, output_path).await
    }

    pub async fn save_as_excel(&self, data: &TestData, output_path: &std::path::Path) -> Result<(), UITraceError> {
        self.excel_parser.save(data, output_path).await
    }

    pub async fn save_as_json(&self, data: &TestData, output_path: &std::path::Path) -> Result<(), UITraceError> {
        self.json_parser.save(data, output_path).await
    }

    pub fn validate_test_data(&self, data: &TestData) -> Result<ValidationResult, UITraceError> {
        let mut result = ValidationResult::new();

        // Check if data has rows
        if data.rows.is_empty() {
            result.add_error("Test data has no rows");
        }

        // Validate each row
        for (index, row) in data.rows.iter().enumerate() {
            if row.data.is_empty() {
                result.add_warning(&format!("Row {} has no data", index + 1));
            }
        }

        // Check for required variables
        for (var_name, _) in &data.variables {
            let found = data.rows.iter().any(|row| row.data.contains_key(var_name));
            if !found {
                result.add_warning(&format!("Variable '{}' not found in any row", var_name));
            }
        }

        Ok(result)
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ValidationResult {
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub is_valid: bool,
}

impl ValidationResult {
    pub fn new() -> Self {
        Self {
            errors: Vec::new(),
            warnings: Vec::new(),
            is_valid: true,
        }
    }

    pub fn add_error(&mut self, error: &str) {
        self.errors.push(error.to_string());
        self.is_valid = false;
    }

    pub fn add_warning(&mut self, warning: &str) {
        self.warnings.push(warning.to_string());
    }
}

impl Default for DataManager {
    fn default() -> Self {
        Self::new()
    }
}