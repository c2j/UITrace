use crate::data::{
    CsvParser, ExcelParser, JsonParser, VariableSubstitutor, DataValidator,
    ValidationConfig, ValidationResult
};
use crate::models::{TestData, DataRow, TestScript};
use crate::utils::error_handler::UITraceError;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use thiserror::Error;
use log::{info, debug, warn};

#[derive(Error, Debug)]
pub enum DataManagerError {
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Unsupported file format: {0}")]
    UnsupportedFormat(String),
    #[error("Parser error: {0}")]
    ParserError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Substitution error: {0}")]
    SubstitutionError(String),
}

/// Context for variable substitution
#[derive(Debug, Clone)]
pub struct SubstitutionContext {
    pub variables: HashMap<String, String>,
    pub exclusions: Vec<String>,
}

impl SubstitutionContext {
    pub fn new() -> Self {
        Self {
            variables: HashMap::new(),
            exclusions: Vec::new(),
        }
    }

    pub fn from_data_row(row: &DataRow) -> Self {
        let mut context = Self::new();
        for (key, value) in &row.values {
            context.variables.insert(key.clone(), value.clone());
        }
        context
    }

    pub fn add_variable(&mut self,
        key: String,
        value: String,
    ) {
        self.variables.insert(key, value);
    }

    pub fn add_exclusion(&mut self,
        key: String,
    ) {
        self.exclusions.push(key);
    }

    pub fn is_excluded(&self,
        key: &str,
    ) -> bool {
        self.exclusions.contains(&key.to_string())
    }
}

/// Configuration for data-driven execution
#[derive(Debug, Clone)]
pub struct DataDrivenConfig {
    pub validation_enabled: bool,
    pub validation_config: ValidationConfig,
    pub stop_on_validation_error: bool,
    pub parallel_execution: bool,
    pub max_parallel_executions: usize,
    pub continue_on_error: bool,
}

impl Default for DataDrivenConfig {
    fn default() -> Self {
        Self {
            validation_enabled: true,
            validation_config: ValidationConfig::default(),
            stop_on_validation_error: false,
            parallel_execution: false,
            max_parallel_executions: 5,
            continue_on_error: true,
        }
    }
}

/// Enhanced data manager with comprehensive data-driven testing functionality
pub struct DataManagerEnhanced {
    csv_parser: CsvParser,
    excel_parser: ExcelParser,
    json_parser: JsonParser,
    validator: DataValidator,
    substitutor: VariableSubstitutor,
    config: DataDrivenConfig,
}

impl DataManagerEnhanced {
    pub fn new() -> Self {
        let validator = DataValidator::with_default_validators();
        let substitutor = VariableSubstitutor::new();
        let config = DataDrivenConfig::default();

        Self {
            csv_parser: CsvParser::new(),
            excel_parser: ExcelParser::new(),
            json_parser: JsonParser::new(),
            validator,
            substitutor,
            config,
        }
    }

    pub fn with_config(
        config: DataDrivenConfig,
    ) -> Self {
        let mut manager = Self::new();
        manager.config = config;
        manager
    }

    /// Load data from a file
    pub async fn load_data(
        &self,
        file_path: &Path,
    ) -> Result<TestData, DataManagerError> {
        if !file_path.exists() {
            return Err(DataManagerError::FileNotFound(
                file_path.to_string_lossy().to_string()
            ));
        }

        let extension = file_path.extension()
            .and_then(|ext| ext.to_str())
            .ok_or_else(|| DataManagerError::UnsupportedFormat(
                "Unknown file extension".to_string()
            ))?;

        info!("Loading data from file: {}", file_path.display());

        let result = match extension {
            "csv" => self.csv_parser.parse(file_path).await,
            "xlsx" | "xls" => self.excel_parser.parse(file_path).await,
            "json" => self.json_parser.parse(file_path).await,
            _ => return Err(DataManagerError::UnsupportedFormat(
                format!("Unsupported file format: {}", extension)
            )),
        };

        match result {
            Ok(test_data) => {
                debug!("Successfully loaded {} rows of data", test_data.rows.len());
                Ok(test_data)
            },
            Err(e) => {
                warn!("Failed to parse data file: {}", e);
                Err(DataManagerError::ParserError(e.to_string()))
            }
        }
    }

    /// Validate data rows
    pub fn validate_data(
        &self,
        test_data: &TestData,
    ) -> Vec<ValidationResult> {
        if !self.config.validation_enabled {
            return vec![];
        }

        info!("Validating {} data rows", test_data.rows.len());

        let results = self.validator.validate_rows(&test_data.rows);
        let summary = self.validator.get_validation_summary(&results);

        info!("Validation complete: {}/{} rows valid ({:.1}% success rate)",
               summary.valid, summary.total, summary.success_rate);

        if summary.invalid > 0 {
            warn!("Found {} invalid rows with {} total errors",
                  summary.invalid, summary.total_errors);

            for (error_type, count) in &summary.common_errors {
                warn!("Most common error: {} ({} occurrences)", error_type, count);
            }
        }

        results
    }

    /// Create substitution context from a data row
    pub fn create_context(
        &self,
        data_row: &DataRow,
    ) -> SubstitutionContext {
        SubstitutionContext::from_data_row(data_row)
    }

    /// Substitute variables in a script
    pub fn substitute_in_script(
        &self,
        script: TestScript,
        context: &SubstitutionContext,
    ) -> Result<TestScript, DataManagerError> {
        debug!("Substituting variables in script with {} variables", context.variables.len());

        // Add context variables to substitutor
        let mut substitutor = VariableSubstitutor::new();
        for (key, value) in &context.variables {
            substitutor.add_variable(key.clone(), value.clone());
        }

        match substitutor.substitute_script(&script) {
            Ok(substituted_script) => {
                debug!("Variable substitution completed successfully");
                Ok(substituted_script)
            },
            Err(e) => {
                warn!("Variable substitution failed: {}", e);
                Err(DataManagerError::SubstitutionError(e.to_string()))
            }
        }
    }

    /// Get summary of available data sources
    pub fn get_supported_formats(&self,
    ) -> Vec<String> {
        vec!["csv".to_string(), "xlsx".to_string(), "xls".to_string(), "json".to_string()]
    }

    /// Check if a file format is supported
    pub fn is_format_supported(
        &self,
        extension: &str,
    ) -> bool {
        matches!(extension, "csv" | "xlsx" | "xls" | "json")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;

    #[tokio::test]
    async fn test_data_manager_creation() {
        let manager = DataManagerEnhanced::new();

        let formats = manager.get_supported_formats();
        assert!(formats.contains(&"csv".to_string()));
        assert!(formats.contains(&"xlsx".to_string()));
        assert!(formats.contains(&"json".to_string()));
    }

    #[tokio::test]
    async fn test_create_context() {
        let manager = DataManagerEnhanced::new();

        let mut row = DataRow::new();
        row.values.insert("username".to_string(), "testuser".to_string());
        row.values.insert("password".to_string(), "testpass".to_string());

        let context = manager.create_context(&row);

        assert_eq!(context.variables.len(), 2);
        assert_eq!(context.variables["username"], "testuser");
        assert_eq!(context.variables["password"], "testpass");
    }

    #[tokio::test]
    async fn test_data_validation_integration() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("validation_test.csv");

        let csv_content = r#"username,age,email
john_doe,25,john@example.com
jane_smith,200,jane@example.com
bob_jones,30,invalid-email"#;

        fs::write(&csv_path, csv_content).unwrap();

        let manager = DataManagerEnhanced::new();
        let test_data = manager.load_data(&csv_path).await.unwrap();

        let validation_results = manager.validate_data(&test_data);

        assert_eq!(validation_results.len(), 3);

        // First row should be valid
        assert!(validation_results[0].is_valid);

        // Second row should have age validation error
        assert!(!validation_results[1].is_valid);
        assert!(validation_results[1].errors.iter().any(|e| e.to_string().contains("age")));

        // Third row should have email validation error
        assert!(!validation_results[2].is_valid);
        assert!(validation_results[2].errors.iter().any(|e| e.to_string().contains("email")));
    }
}

// Re-export for convenience
pub use data_manager_enhanced::{DataManagerEnhanced, DataDrivenConfig, SubstitutionContext};