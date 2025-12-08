use crate::models::{DataRow, DataType};
use std::collections::HashMap;
use regex::Regex;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ValidationError {
    #[error("Invalid email format: {0}")]
    InvalidEmail(String),
    #[error("Invalid number format: {0}")]
    InvalidNumber(String),
    #[error("Invalid date format: {0}")]
    InvalidDate(String),
    #[error("Invalid URL format: {0}")]
    InvalidUrl(String),
    #[error("Value out of range: {0} (min: {1}, max: {2})")]
    OutOfRange(String, f64, f64),
    #[error("String too long: {0} (max: {1})")]
    StringTooLong(String, usize),
    #[error("String too short: {0} (min: {1})")]
    StringTooShort(String, usize),
    #[error("Missing required field: {0}")]
    MissingRequiredField(String),
    #[error("Invalid format: {0}")]
    InvalidFormat(String),
    #[error("Pattern mismatch: {0} (pattern: {1})")]
    PatternMismatch(String, String),
}

/// Result of data validation
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<String>,
}

impl ValidationResult {
    pub fn new() -> Self {
        Self {
            is_valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    pub fn add_error(&mut self,
        error: ValidationError,
    ) {
        self.is_valid = false;
        self.errors.push(error);
    }

    pub fn add_warning(&mut self,
        warning: String,
    ) {
        self.warnings.push(warning);
    }

    pub fn merge(&mut self,
        other: ValidationResult,
    ) {
        if !other.is_valid {
            self.is_valid = false;
        }
        self.errors.extend(other.errors);
        self.warnings.extend(other.warnings);
    }
}

/// Configuration for data validation
#[derive(Debug, Clone)]
pub struct ValidationConfig {
    pub required_fields: Vec<String>,
    pub field_validators: HashMap<String, FieldValidator>,
    pub allow_empty_rows: bool,
    pub max_row_length: Option<usize>,
    pub min_row_length: Option<usize>,
}

impl Default for ValidationConfig {
    fn default() -> Self {
        Self {
            required_fields: Vec::new(),
            field_validators: HashMap::new(),
            allow_empty_rows: false,
            max_row_length: None,
            min_row_length: None,
        }
    }
}

/// Validator for individual fields
#[derive(Debug, Clone)]
pub enum FieldValidator {
    Email,
    Number {
        min: Option<f64>,
        max: Option<f64>,
        integer_only: bool,
    },
    Date {
        format: String,
    },
    String {
        min_length: Option<usize>,
        max_length: Option<usize>,
        pattern: Option<String>,
    },
    Url,
    Boolean,
    Custom {
        validator: fn(&str) -> Result<(), String>,
    },
}

/// Comprehensive data validator
pub struct DataValidator {
    config: ValidationConfig,
    email_regex: Regex,
    url_regex: Regex,
}

impl DataValidator {
    pub fn new(config: ValidationConfig) -> Self {
        Self {
            config,
            email_regex: Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap(),
            url_regex: Regex::new(r"^https?://[^\s/$.?#].[^\s]*$").unwrap(),
        }
    }

    pub fn with_default_validators() -> Self {
        let mut config = ValidationConfig::default();

        // Add common field validators
        config.field_validators.insert("email".to_string(), FieldValidator::Email);
        config.field_validators.insert("age".to_string(), FieldValidator::Number {
            min: Some(0.0),
            max: Some(150.0),
            integer_only: true,
        });
        config.field_validators.insert("score".to_string(), FieldValidator::Number {
            min: Some(0.0),
            max: Some(100.0),
            integer_only: false,
        });
        config.field_validators.insert("url".to_string(), FieldValidator::Url);
        config.field_validators.insert("active".to_string(), FieldValidator::Boolean);

        Self::new(config)
    }

    /// Validate a single data row
    pub fn validate_row(
        &self,
        row: &DataRow,
    ) -> ValidationResult {
        let mut result = ValidationResult::new();

        // Check required fields
        for required_field in &self.config.required_fields {
            if !row.values.contains_key(required_field) || row.values[required_field].trim().is_empty() {
                result.add_error(ValidationError::MissingRequiredField(required_field.clone()));
            }
        }

        // Validate each field
        for (field_name, value) in &row.values {
            // Skip empty values unless it's a required field
            if value.trim().is_empty() && !self.config.required_fields.contains(field_name) {
                continue;
            }

            // Apply field-specific validation if configured
            if let Some(validator) = self.config.field_validators.get(field_name) {
                if let Err(e) = self.validate_field(value, validator) {
                    result.add_error(e);
                }
            }

            // Check row length constraints
            if let Some(max_length) = self.config.max_row_length {
                if value.len() > max_length {
                    result.add_warning(format!("Field '{}' exceeds maximum length of {}", field_name, max_length));
                }
            }

            if let Some(min_length) = self.config.min_row_length {
                if value.len() < min_length {
                    result.add_warning(format!("Field '{}' is shorter than minimum length of {}", field_name, min_length));
                }
            }
        }

        result
    }

    /// Validate a single field value
    fn validate_field(
        &self,
        value: &str,
        validator: &FieldValidator,
    ) -> Result<(), ValidationError> {
        match validator {
            FieldValidator::Email => {
                if !self.email_regex.is_match(value) {
                    return Err(ValidationError::InvalidEmail(value.to_string()));
                }
            },
            FieldValidator::Number { min, max, integer_only } => {
                let num_result = if *integer_only {
                    value.parse::<i64>()
                        .map(|n| n as f64)
                        .map_err(|_| ValidationError::InvalidNumber(value.to_string()))
                } else {
                    value.parse::<f64>()
                        .map_err(|_| ValidationError::InvalidNumber(value.to_string()))
                };

                match num_result {
                    Ok(num) => {
                        if let Some(min_val) = min {
                            if num < *min_val {
                                return Err(ValidationError::OutOfRange(
                                    value.to_string(),
                                    *min_val,
                                    max.unwrap_or(f64::INFINITY),
                                ));
                            }
                        }
                        if let Some(max_val) = max {
                            if num > *max_val {
                                return Err(ValidationError::OutOfRange(
                                    value.to_string(),
                                    min.unwrap_or(f64::NEG_INFINITY),
                                    *max_val,
                                ));
                            }
                        }
                    },
                    Err(e) => return Err(e),
                }
            },
            FieldValidator::Date { format } => {
                // Simple date validation - in real implementation would use chrono
                if format == "YYYY-MM-DD" {
                    let date_regex = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
                    if !date_regex.is_match(value) {
                        return Err(ValidationError::InvalidDate(value.to_string()));
                    }
                }
            },
            FieldValidator::String { min_length, max_length, pattern } => {
                if let Some(min) = min_length {
                    if value.len() < *min {
                        return Err(ValidationError::StringTooShort(value.to_string(), *min));
                    }
                }
                if let Some(max) = max_length {
                    if value.len() > *max {
                        return Err(ValidationError::StringTooLong(value.to_string(), *max));
                    }
                }
                if let Some(pattern_str) = pattern {
                    let pattern_regex = Regex::new(pattern_str)
                        .map_err(|e| ValidationError::InvalidFormat(format!("Invalid regex pattern: {}", e)))?;
                    if !pattern_regex.is_match(value) {
                        return Err(ValidationError::PatternMismatch(value.to_string(), pattern_str.clone()));
                    }
                }
            },
            FieldValidator::Url => {
                if !self.url_regex.is_match(value) {
                    return Err(ValidationError::InvalidUrl(value.to_string()));
                }
            },
            FieldValidator::Boolean => {
                let lower_value = value.to_lowercase();
                if lower_value != "true" && lower_value != "false" && lower_value != "1" && lower_value != "0" {
                    return Err(ValidationError::InvalidFormat(format!("Invalid boolean value: {}", value)));
                }
            },
            FieldValidator::Custom { validator } => {
                validator(value).map_err(|e| ValidationError::InvalidFormat(e))?;
            },
        }

        Ok(())
    }

    /// Infer data type from a value
    pub fn infer_data_type(&self,
        value: &str,
    ) -> DataType {
        if value.is_empty() {
            return DataType::String;
        }

        // Try boolean
        let lower = value.to_lowercase();
        if lower == "true" || lower == "false" {
            return DataType::Boolean;
        }

        // Try number
        if value.parse::<f64>().is_ok() {
            return DataType::Number;
        }

        // Try date (simple check)
        if value.contains('-') && value.len() >= 10 {
            // Could be ISO date format
            return DataType::Date;
        }

        // Try URL
        if self.url_regex.is_match(value) {
            return DataType::Url;
        }

        // Try email
        if self.email_regex.is_match(value) {
            return DataType::Email;
        }

        DataType::String
    }

    /// Validate multiple rows
    pub fn validate_rows(
        &self,
        rows: &[DataRow],
    ) -> Vec<ValidationResult> {
        rows.iter()
            .map(|row| self.validate_row(row))
            .collect()
    }

    /// Get validation summary for multiple rows
    pub fn get_validation_summary(
        &self,
        results: &[ValidationResult],
    ) -> ValidationSummary {
        let total = results.len();
        let valid = results.iter().filter(|r| r.is_valid).count();
        let invalid = total - valid;

        let total_errors: usize = results.iter().map(|r| r.errors.len()).sum();
        let total_warnings: usize = results.iter().map(|r| r.warnings.len()).sum();

        let common_errors = self.get_common_errors(results);

        ValidationSummary {
            total,
            valid,
            invalid,
            total_errors,
            total_warnings,
            common_errors,
            success_rate: if total > 0 {
                (valid as f64 / total as f64) * 100.0
            } else {
                0.0
            },
        }
    }

    /// Get common validation errors across all results
    fn get_common_errors(
        &self,
        results: &[ValidationResult],
    ) -> Vec<(String, usize)> {
        let mut error_counts = std::collections::HashMap::new();

        for result in results {
            for error in &result.errors {
                let error_type = format!("{:?}", error);
                *error_counts.entry(error_type).or_insert(0) += 1;
            }
        }

        let mut common_errors: Vec<(String, usize)> = error_counts.into_iter().collect();
        common_errors.sort_by(|a, b| b.1.cmp(&a.1)); // Sort by count descending
        common_errors
    }
}

/// Summary of validation results
#[derive(Debug, Clone)]
pub struct ValidationSummary {
    pub total: usize,
    pub valid: usize,
    pub invalid: usize,
    pub total_errors: usize,
    pub total_warnings: usize,
    pub common_errors: Vec<(String, usize)>,
    pub success_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_validation() {
        let validator = DataValidator::with_default_validators();
        let config = ValidationConfig {
            required_fields: vec!["email".to_string()],
            ..Default::default()
        };
        let validator = DataValidator::new(config);

        let mut row = DataRow::new();
        row.values.insert("email".to_string(), "test@example.com".to_string());

        let result = validator.validate_row(&row);
        assert!(result.is_valid);

        // Invalid email
        row.values.insert("email".to_string(), "invalid-email".to_string());
        let result = validator.validate_row(&row);
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| matches!(e, ValidationError::InvalidEmail(_))));
    }

    #[test]
    fn test_number_validation() {
        let mut config = ValidationConfig::default();
        config.field_validators.insert("age".to_string(), FieldValidator::Number {
            min: Some(0.0),
            max: Some(150.0),
            integer_only: true,
        });

        let validator = DataValidator::new(config);
        let mut row = DataRow::new();

        // Valid number
        row.values.insert("age".to_string(), "25".to_string());
        let result = validator.validate_row(&row);
        assert!(result.is_valid);

        // Out of range
        row.values.insert("age".to_string(), "200".to_string());
        let result = validator.validate_row(&row);
        assert!(!result.is_valid);
    }

    #[test]
    fn test_required_fields() {
        let config = ValidationConfig {
            required_fields: vec!["username".to_string(), "email".to_string()],
            ..Default::default()
        };

        let validator = DataValidator::new(config);
        let mut row = DataRow::new();

        // Missing required field
        row.values.insert("email".to_string(), "test@example.com".to_string());
        let result = validator.validate_row(&row);
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| matches!(e, ValidationError::MissingRequiredField(_))));

        // All required fields present
        row.values.insert("username".to_string(), "testuser".to_string());
        let result = validator.validate_row(&row);
        assert!(result.is_valid);
    }

    #[test]
    fn test_data_type_inference() {
        let validator = DataValidator::with_default_validators();

        assert_eq!(validator.infer_data_type("123"), DataType::Number);
        assert_eq!(validator.infer_data_type("123.45"), DataType::Number);
        assert_eq!(validator.infer_data_type("true"), DataType::Boolean);
        assert_eq!(validator.infer_data_type("false"), DataType::Boolean);
        assert_eq!(validator.infer_data_type("2023-12-08"), DataType::Date);
        assert_eq!(validator.infer_data_type("hello"), DataType::String);
        assert_eq!(validator.infer_data_type("test@example.com"), DataType::Email);
        assert_eq!(validator.infer_data_type("https://example.com"), DataType::Url);
    }
}

// Re-export for convenience
pub use data_validator::DataValidator;