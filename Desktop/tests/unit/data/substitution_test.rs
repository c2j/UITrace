use uitrace_desktop::data::{VariableSubstitutor, SubstitutionContext};
use uitrace_desktop::models::{TestScript, TestStep};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_variable_substitution() {
        let substitutor = VariableSubstitutor::new();

        let context = SubstitutionContext::from_vec(vec![
            ("username".to_string(), "john_doe".to_string()),
            ("password".to_string(), "secret123".to_string()),
            ("email".to_string(), "john@example.com".to_string()),
        ]);

        let test_cases = vec![
            ("Enter ${username}", "Enter john_doe"),
            ("Password: ${password}", "Password: secret123"),
            ("Email: ${email}", "Email: john@example.com"),
            ("No substitution needed", "No substitution needed"),
            ("Multiple ${username} and ${email}", "Multiple john_doe and john@example.com"),
        ];

        for (input, expected) in test_cases {
            let result = substitutor.substitute(input, &context);
            assert_eq!(result, expected, "Failed for input: {}", input);
        }
    }

    #[test]
    fn test_nested_variable_substitution() {
        let substitutor = VariableSubstitutor::new();

        let context = SubstitutionContext::from_vec(vec![
            ("base_url".to_string(), "https://example.com".to_string()),
            ("endpoint".to_string(), "/api/users".to_string()),
            ("user_id".to_string(), "123".to_string()),
        ]);

        let input = "Navigate to ${base_url}${endpoint}/${user_id}";
        let result = substitutor.substitute(input, &context);
        assert_eq!(result, "Navigate to https://example.com/api/users/123");
    }

    #[test]
    fn test_undefined_variable_handling() {
        let substitutor = VariableSubstitutor::new();

        let context = SubstitutionContext::from_vec(vec![
            ("defined_var".to_string(), "value".to_string()),
        ]);

        let input = "This has ${undefined_var} and ${defined_var}";
        let result = substitutor.substitute(input, &context);

        // Should leave undefined variables as-is
        assert_eq!(result, "This has ${undefined_var} and value");
    }

    #[test]
    fn test_special_characters_in_variables() {
        let substitutor = VariableSubstitutor::new();

        let context = SubstitutionContext::from_vec(vec![
            ("special_chars".to_string(), "Hello, World! @#$%".to_string()),
            ("unicode".to_string(), "你好世界 🌍".to_string()),
            ("newlines".to_string(), "Line 1\nLine 2".to_string()),
        ]);

        let test_cases = vec![
            ("Text: ${special_chars}", "Text: Hello, World! @#$%"),
            ("Unicode: ${unicode}", "Unicode: 你好世界 🌍"),
            ("Newlines: ${newlines}", "Text: Line 1\nLine 2"),
        ];

        for (input, expected) in test_cases {
            let result = substitutor.substitute(input, &context);
            assert_eq!(result, expected, "Failed for input: {}", input);
        }
    }

    #[test]
    fn test_case_sensitive_substitution() {
        let substitutor = VariableSubstitutor::new();

        let context = SubstitutionContext::from_vec(vec![
            ("Username".to_string(), "JohnDoe".to_string()),
            ("username".to_string(), "johndoe".to_string()),
        ]);

        let input = "${Username} vs ${username}";
        let result = substitutor.substitute(input, &context);
        assert_eq!(result, "JohnDoe vs johndoe");
    }

    #[test]
    fn test_empty_and_whitespace_variables() {
        let substitutor = VariableSubstitutor::new();

        let context = SubstitutionContext::from_vec(vec![
            ("empty".to_string(), "".to_string()),
            ("spaces".to_string(), "   ".to_string()),
            ("tabs".to_string(), "\t\t".to_string()),
        ]);

        let test_cases = vec![
            ("Empty: '${empty}'", "Empty: ''"),
            ("Spaces: '${spaces}'", "Spaces: '   '"),
            ("Tabs: '${tabs}'", "Tabs: '\t\t'"),
        ];

        for (input, expected) in test_cases {
            let result = substitutor.substitute(input, &context);
            assert_eq!(result, expected, "Failed for input: {}", input);
        }
    }

    #[test]
    fn test_script_step_substitution() {
        let substitutor = VariableSubstitutor::new();

        let mut script = TestScript::new("Test Script".to_string(), "test_user".to_string());

        let step1 = TestStep::new(1, "Login".to_string(), "type".to_string())
            .with_value("${username}");

        let step2 = TestStep::new(2, "Password".to_string(), "type".to_string())
            .with_value("${password}");

        let step3 = TestStep::new(3, "Navigate".to_string(), "navigate".to_string())
            .with_value("${base_url}/dashboard");

        script.steps.push(step1);
        script.steps.push(step2);
        script.steps.push(step3);

        let context = SubstitutionContext::from_vec(vec![
            ("username".to_string(), "testuser".to_string()),
            ("password".to_string(), "testpass123".to_string()),
            ("base_url".to_string(), "https://example.com".to_string()),
        ]);

        let result = substitutor.substitute_in_script(script, &context);

        assert!(result.is_ok());
        let substituted_script = result.unwrap();

        assert_eq!(substituted_script.steps[0].value, Some("testuser".to_string()));
        assert_eq!(substituted_script.steps[1].value, Some("testpass123".to_string()));
        assert_eq!(substituted_script.steps[2].value, Some("https://example.com/dashboard".to_string()));
    }

    #[test]
    fn test_selective_substitution() {
        let substitutor = VariableSubstitutor::new();

        let mut script = TestScript::new("Test Script".to_string(), "test_user".to_string());

        // Step that should be substituted
        let step1 = TestStep::new(1, "Login".to_string(), "type".to_string())
            .with_value("${username}");

        // Step that should NOT be substituted (e.g., contains user input)
        let step2 = TestStep::new(2, "Custom Input".to_string(), "type".to_string())
            .with_value("${user_input}");

        script.steps.push(step1);
        script.steps.push(step2);

        let mut context = SubstitutionContext::from_vec(vec![
            ("username".to_string(), "testuser".to_string()),
        ]);

        // Mark user_input as not substitutable
        context.add_exclusion("user_input".to_string());

        let result = substitutor.substitute_in_script(script, &context);

        assert!(result.is_ok());
        let substituted_script = result.unwrap();

        assert_eq!(substituted_script.steps[0].value, Some("testuser".to_string()));
        assert_eq!(substituted_script.steps[1].value, Some("${user_input}".to_string())); // Not substituted
    }

    #[test]
    fn test_context_operations() {
        let mut context = SubstitutionContext::new();

        // Add variables
        context.set("var1".to_string(), "value1".to_string());
        context.set("var2".to_string(), "value2".to_string());

        assert_eq!(context.get("var1"), Some(&"value1".to_string()));
        assert_eq!(context.get("var2"), Some(&"value2".to_string()));
        assert_eq!(context.get("nonexistent"), None);

        // Update variable
        context.set("var1".to_string(), "new_value1".to_string());
        assert_eq!(context.get("var1"), Some(&"new_value1".to_string()));

        // Remove variable
        context.remove("var2");
        assert_eq!(context.get("var2"), None);

        // Get all variables
        let all_vars = context.get_all();
        assert_eq!(all_vars.len(), 1);
        assert_eq!(all_vars["var1"], "new_value1");
    }

    #[test]
    fn test_recursive_substitution_prevention() {
        let substitutor = VariableSubstitutor::new();

        let mut context = SubstitutionContext::new();

        // This could cause infinite recursion if not handled properly
        context.set("a".to_string(), "${b}".to_string());
        context.set("b".to_string(), "${a}".to_string());

        let input = "Value: ${a}";
        let result = substitutor.substitute(input, &context);

        // Should handle recursion gracefully - either substitute once or leave as-is
        assert!(result == "Value: ${b}" || result == "Value: ${a}");
    }

    #[test]
    fn test_performance_with_many_variables() {
        let substitutor = VariableSubstitutor::new();
        let mut context = SubstitutionContext::new();

        // Add 1000 variables
        for i in 0..1000 {
            context.set(format!("var{}", i), format!("value{}", i));
        }

        let input = "Start ${var0} middle ${var500} end ${var999}";

        let start = std::time::Instant::now();
        let result = substitutor.substitute(input, &context);
        let duration = start.elapsed();

        assert_eq!(result, "Start value0 middle value500 end value999");

        // Should complete in reasonable time (less than 100ms for 1000 variables)
        assert!(duration.as_millis() < 100, "Substitution took too long: {:?}", duration);
    }

    #[test]
    fn test_template_substitution() {
        let substitutor = VariableSubstitutor::new();

        let template = r#"{
            "username": "${username}",
            "email": "${email}",
            "profile": {
                "name": "${full_name}",
                "age": ${age}
            }
        }"#;

        let context = SubstitutionContext::from_vec(vec![
            ("username".to_string(), "johndoe".to_string()),
            ("email".to_string(), "john@example.com".to_string()),
            ("full_name".to_string(), "John Doe".to_string()),
            ("age".to_string(), "30".to_string()),
        ]);

        let result = substitutor.substitute(template, &context);

        assert!(result.contains("johndoe"));
        assert!(result.contains("john@example.com"));
        assert!(result.contains("John Doe"));
        assert!(result.contains("\"age\": 30"));
    }
}

// Helper functions and traits that would be part of the actual implementation

impl SubstitutionContext {
    pub fn new() -> Self {
        Self {
            variables: std::collections::HashMap::new(),
            exclusions: std::collections::HashSet::new(),
        }
    }

    pub fn from_vec(vars: Vec<(String, String)>) -> Self {
        let mut context = Self::new();
        for (key, value) in vars {
            context.set(key, value);
        }
        context
    }

    pub fn set(&mut self, key: String, value: String) {
        self.variables.insert(key, value);
    }

    pub fn get(&self, key: &str) -> Option<&String> {
        self.variables.get(key)
    }

    pub fn remove(&mut self, key: &str) {
        self.variables.remove(key);
    }

    pub fn add_exclusion(&mut self, key: String) {
        self.exclusions.insert(key);
    }

    pub fn is_excluded(&self, key: &str) -> bool {
        self.exclusions.contains(key)
    }

    pub fn get_all(&self) -> &std::collections::HashMap<String, String> {
        &self.variables
    }
}

struct SubstitutionContext {
    variables: std::collections::HashMap<String, String>,
    exclusions: std::collections::HashSet<String>,
}

struct VariableSubstitutor {
    // Configuration options would go here
}

impl VariableSubstitutor {
    pub fn new() -> Self {
        Self {}
    }

    pub fn substitute(&self,
        input: &str,
        context: &SubstitutionContext,
    ) -> String {
        let mut result = input.to_string();

        // Find all ${variable} patterns
        let pattern = regex::Regex::new(r#"\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}"#).unwrap();

        for cap in pattern.captures_iter(input) {
            let full_match = &cap[0];
            let var_name = &cap[1];

            // Skip if variable is excluded
            if context.is_excluded(var_name) {
                continue;
            }

            if let Some(value) = context.get(var_name) {
                result = result.replace(full_match, value);
            }
        }

        result
    }

    pub fn substitute_in_script(
        &self,
        script: TestScript,
        context: &SubstitutionContext,
    ) -> Result<TestScript, String> {
        let mut substituted_script = script;

        for step in &mut substituted_script.steps {
            if let Some(ref value) = step.value {
                let substituted_value = self.substitute(value, context);
                step.value = Some(substituted_value);
            }

            // Also substitute in selector values if needed
            for selector in &mut step.selectors {
                let substituted_value = self.substitute(&selector.value, context);
                selector.value = substituted_value;
            }
        }

        Ok(substituted_script)
    }
}

// Note: This would need the regex crate in Cargo.toml
// regex = "1.0" would need to be added to dependencies