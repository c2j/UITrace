use crate::models::{TestStep, TestScript, DataRow};
use std::collections::HashMap;
use regex::Regex;
use thiserror::Error;
use log::{debug, warn};
use rand;

#[derive(Error, Debug)]
pub enum SubstitutionError {
    #[error("Variable not found: {0}")]
    VariableNotFound(String),
    #[error("Invalid variable syntax: {0}")]
    InvalidSyntax(String),
    #[error("Circular reference detected: {0}")]
    CircularReference(String),
    #[error("Regex error: {0}")]
    Regex(#[from] regex::Error),
}

#[derive(Debug, Clone)]
pub struct VariableSubstitutor {
    variables: HashMap<String, String>,
    patterns: Vec<Regex>,
}

impl VariableSubstitutor {
    pub fn new() -> Self {
        let patterns = vec![
            // ${variable} format
            Regex::new(r"\$\{([^}]+)\}").unwrap(),
            // {{variable}} format
            Regex::new(r"\{\{([^}]+)\}\}").unwrap(),
            // $variable format (simple variables)
            Regex::new(r"\$(\w+)").unwrap(),
        ];

        Self {
            variables: HashMap::new(),
            patterns,
        }
    }

    /// Create substitutor with predefined variables
    pub fn with_variables(variables: HashMap<String, String>) -> Self {
        let mut substitutor = Self::new();
        substitutor.variables = variables;
        substitutor
    }

    /// Add a variable
    pub fn add_variable(&mut self, key: String, value: String) {
        self.variables.insert(key, value);
    }

    /// Add variables from a DataRow
    pub fn add_variables_from_row(&mut self, row: &DataRow) {
        for (key, value) in &row.data {
            self.variables.insert(key.clone(), value.clone());
        }
    }

    /// Check if a variable exists
    pub fn has_variable(&self, key: &str) -> bool {
        self.variables.contains_key(key)
    }

    /// Get a variable value
    pub fn get_variable(&self, key: &str) -> Option<&String> {
        self.variables.get(key)
    }

    /// Substitute variables in a string
    pub fn substitute(&self, input: &str) -> Result<String, SubstitutionError> {
        let mut result = input.to_string();

        // Apply each pattern
        for pattern in &self.patterns {
            result = self.substitute_with_pattern(&result, pattern)?;
        }

        Ok(result)
    }

    /// Substitute variables using a specific regex pattern
    fn substitute_with_pattern(&self, input: &str, pattern: &Regex) -> Result<String, SubstitutionError> {
        let mut result = input.to_string();
        let mut visited = std::collections::HashSet::new();

        // Keep substituting until no more matches or circular reference detected
        loop {
            let mut changed = false;
            let captures: Vec<_> = pattern.captures_iter(&result).collect();

            for cap in captures {
                let var_name = cap.get(1).unwrap().as_str();
                let full_match = cap.get(0).unwrap().as_str();

                // Check for circular reference
                if visited.contains(var_name) {
                    return Err(SubstitutionError::CircularReference(
                        format!("Circular reference in variable: {}", var_name)
                    ));
                }

                if let Some(value) = self.variables.get(var_name) {
                    // Recursively substitute in the value
                    visited.insert(var_name.to_string());
                    let substituted_value = if pattern.is_match(value) {
                        self.substitute_with_pattern(value, pattern)?
                    } else {
                        value.clone()
                    };
                    visited.remove(var_name);

                    result = result.replace(full_match, &substituted_value);
                    changed = true;
                } else {
                    // Variable not found - keep original or use empty string
                    warn!("Variable '{}' not found in substitution", var_name);
                    result = result.replace(full_match, "");
                }
            }

            if !changed {
                break;
            }
        }

        Ok(result)
    }

    /// Substitute variables in a TestStep
    pub fn substitute_step(&self, step: &TestStep) -> Result<TestStep, SubstitutionError> {
        let mut new_step = step.clone();

        // Substitute in value field
        if let Some(value) = &step.value {
            new_step.value = Some(self.substitute(value)?);
        }

        // Substitute in selectors
        for selector in &mut new_step.selectors {
            selector.value = self.substitute(&selector.value)?;
        }

        // Substitute in metadata
        for (key, value) in &mut new_step.metadata {
            if let serde_json::Value::String(s) = value {
                *value = serde_json::Value::String(self.substitute(s)?);
            }
        }

        Ok(new_step)
    }

    /// Substitute variables in an entire TestScript
    pub fn substitute_script(&self, script: &TestScript) -> Result<TestScript, SubstitutionError> {
        let mut new_script = script.clone();

        // Substitute in script metadata
        for (key, value) in &mut new_script.metadata {
            if let serde_json::Value::String(s) = value {
                *value = serde_json::Value::String(self.substitute(s)?);
            }
        }

        // Substitute in each step
        for step in &mut new_script.steps {
            *step = self.substitute_step(step)?;
        }

        Ok(new_script)
    }

    /// Get all variables found in a string
    pub fn extract_variables(&self, input: &str) -> Vec<String> {
        let mut variables = Vec::new();

        for pattern in &self.patterns {
            for cap in pattern.captures_iter(input) {
                let var_name = cap.get(1).unwrap().as_str();
                if !variables.contains(&var_name.to_string()) {
                    variables.push(var_name.to_string());
                }
            }
        }

        variables
    }

    /// Validate that all variables in a string have values
    pub fn validate_variables(&self, input: &str) -> Result<(), SubstitutionError> {
        let variables = self.extract_variables(input);

        for var in variables {
            if !self.variables.contains_key(&var) {
                return Err(SubstitutionError::VariableNotFound(var));
            }
        }

        Ok(())
    }

    /// Clear all variables
    pub fn clear(&mut self) {
        self.variables.clear();
    }

    /// Get all current variables
    pub fn get_variables(&self) -> &HashMap<String, String> {
        &self.variables
    }

    /// Load variables from environment variables with prefix
    pub fn load_from_env(&mut self, prefix: &str) {
        for (key, value) in std::env::vars() {
            if key.starts_with(prefix) {
                let var_name = key.strip_prefix(prefix).unwrap();
                self.variables.insert(var_name.to_string(), value);
            }
        }
    }

    /// Create a substitutor with common test variables
    pub fn with_common_variables() -> Self {
        let mut variables = HashMap::new();

        // Add current timestamp
        variables.insert("TIMESTAMP".to_string(),
            chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string());

        // Add current date
        variables.insert("DATE".to_string(),
            chrono::Utc::now().format("%Y-%m-%d").to_string());

        // Add random values
        variables.insert("RANDOM_INT".to_string(),
            rand::random::<u32>() % 9000 + 1000); // 1000-9999

        variables.insert("UUID".to_string(),
            uuid::Uuid::new_v4().to_string());

        Self::with_variables(variables)
    }
}

impl Default for VariableSubstitutor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TestStep;
    use crate::models::selector::Selector;

    #[test]
    fn test_basic_substitution() {
        let mut substitutor = VariableSubstitutor::new();
        substitutor.add_variable("name".to_string(), "John".to_string());
        substitutor.add_variable("age".to_string(), "30".to_string());

        let result = substitutor.substitute("Hello ${name}, you are ${age} years old").unwrap();
        assert_eq!(result, "Hello John, you are 30 years old");
    }

    #[test]
    fn test_multiple_patterns() {
        let mut substitutor = VariableSubstitutor::new();
        substitutor.add_variable("var".to_string(), "VALUE".to_string());

        let result = substitutor.substitute("${var} and {{var}} and $var").unwrap();
        assert_eq!(result, "VALUE and VALUE and VALUE");
    }

    #[test]
    fn test_substitution_in_test_step() {
        let mut substitutor = VariableSubstitutor::new();
        substitutor.add_variable("username".to_string(), "testuser".to_string());
        substitutor.add_variable("button_id".to_string(), "submit-btn".to_string());

        let step = TestStep::new(
            1,
            "Enter ${username}".to_string(),
            "type".to_string(),
        )
        .with_value("${username}")
        .with_selectors(vec![
            Selector::new("id".to_string(), "${button_id}".to_string(), 1),
        ]);

        let substituted = substitutor.substitute_step(&step).unwrap();
        assert_eq!(substituted.description, "Enter testuser");
        assert_eq!(substituted.value, Some("testuser".to_string()));
        assert_eq!(substituted.selectors[0].value, "submit-btn");
    }

    #[test]
    fn test_extract_variables() {
        let substitutor = VariableSubstitutor::new();
        let variables = substitutor.extract_variables("Hello ${name}, your email is {{email}} and phone is $phone");

        assert_eq!(variables.len(), 3);
        assert!(variables.contains(&"name".to_string()));
        assert!(variables.contains(&"email".to_string()));
        assert!(variables.contains(&"phone".to_string()));
    }

    #[test]
    fn test_variable_not_found() {
        let substitutor = VariableSubstitutor::new();
        let result = substitutor.substitute("Hello ${name}");
        assert!(result.is_ok()); // It replaces missing vars with empty string

        let validation = substitutor.validate_variables("Hello ${name}");
        assert!(validation.is_err());
    }

    #[test]
    fn test_circular_reference() {
        let mut substitutor = VariableSubstitutor::new();
        substitutor.add_variable("var1".to_string(), "${var2}".to_string());
        substitutor.add_variable("var2".to_string(), "${var1}".to_string());

        let result = substitutor.substitute("${var1}");
        assert!(result.is_err());
        match result.unwrap_err() {
            SubstitutionError::CircularReference(_) => {},
            _ => panic!("Expected CircularReference error"),
        }
    }

    #[test]
    fn test_common_variables() {
        let substitutor = VariableSubstitutor::with_common_variables();

        assert!(substitutor.has_variable("TIMESTAMP"));
        assert!(substitutor.has_variable("DATE"));
        assert!(substitutor.has_variable("UUID"));

        let result = substitutor.substitute("Test at ${TIMESTAMP}");
        assert!(result.unwrap().contains("Test at"));
        assert!(result.unwrap().len() > "Test at ".len());
    }
}
