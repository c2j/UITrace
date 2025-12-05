use std::path::Path;

pub fn validate_script_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err("Script name cannot be empty".to_string());
    }

    if trimmed.len() > 100 {
        return Err("Script name cannot exceed 100 characters".to_string());
    }

    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Script name cannot contain path separators".to_string());
    }

    if trimmed.starts_with('.') {
        return Err("Script name cannot start with a dot".to_string());
    }

    Ok(trimmed.to_string())
}

pub fn validate_selector(selector: &str) -> Result<String, String> {
    let trimmed = selector.trim();

    if trimmed.is_empty() {
        return Err("Selector cannot be empty".to_string());
    }

    if trimmed.len() > 1000 {
        return Err("Selector cannot exceed 1000 characters".to_string());
    }

    // Basic CSS selector validation
    if !is_valid_css_selector(trimmed) {
        return Err("Invalid CSS selector format".to_string());
    }

    Ok(trimmed.to_string())
}

pub fn validate_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();

    if trimmed.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }

    // Basic URL validation using url crate
    match url::Url::parse(trimmed) {
        Ok(_) => Ok(trimmed.to_string()),
        Err(e) => Err(format!("Invalid URL: {}", e)),
    }
}

pub fn validate_file_path(path: &str) -> Result<String, String> {
    let trimmed = path.trim();

    if trimmed.is_empty() {
        return Err("File path cannot be empty".to_string());
    }

    if trimmed.len() > 500 {
        return Err("File path cannot exceed 500 characters".to_string());
    }

    // Check for invalid characters
    if trimmed.contains('\0') {
        return Err("File path cannot contain null characters".to_string());
    }

    // Check if path is absolute or relative
    let path_obj = Path::new(trimmed);
    if path_obj.is_absolute() && !path_obj.exists() {
        return Err("Absolute path does not exist".to_string());
    }

    Ok(trimmed.to_string())
}

pub fn validate_wait_time(millis: u64) -> Result<u64, String> {
    if millis == 0 {
        return Err("Wait time cannot be zero".to_string());
    }

    if millis > 300000 { // 5 minutes
        return Err("Wait time cannot exceed 5 minutes (300000ms)".to_string());
    }

    Ok(millis)
}

pub fn validate_test_name(name: &str) -> Result<String, String> {
    validate_script_name(name) // Reuse script name validation for test names
}

pub fn validate_project_name(name: &str) -> Result<String, String> {
    validate_script_name(name) // Reuse script name validation for project names
}

fn is_valid_css_selector(selector: &str) -> bool {
    // Basic CSS selector validation
    if selector.is_empty() {
        return false;
    }

    // Check for common selector patterns
    let patterns = [
        "#", // ID selector
        ".", // Class selector
        "[", // Attribute selector
        ":", // Pseudo-class/element
        " ", // Descendant combinator
        ">", // Child combinator
        "+", // Adjacent sibling combinator
        "~", // General sibling combinator
    ];

    // Check if it's a valid tag name (starts with letter, contains letters/numbers/hyphens)
    let is_tag_name = selector.chars().next().map(|c| c.is_alphabetic()).unwrap_or(false)
        && selector.chars().all(|c| c.is_alphanumeric() || c == '-');

    // Check if it matches any known pattern
    let matches_pattern = patterns.iter().any(|pattern| selector.contains(pattern));

    is_tag_name || matches_pattern
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_script_name() {
        assert!(validate_script_name("valid_name").is_ok());
        assert!(validate_script_name("Valid Name 123").is_ok());

        assert!(validate_script_name("").is_err());
        assert!(validate_script_name("   ").is_err());
        assert!(validate_script_name("invalid/name").is_err());
        assert!(validate_script_name(".hidden").is_err());
    }

    #[test]
    fn test_validate_selector() {
        assert!(validate_selector("#myId").is_ok());
        assert!(validate_selector(".myClass").is_ok());
        assert!(validate_selector("button").is_ok());
        assert!(validate_selector("[data-test='value']").is_ok());

        assert!(validate_selector("").is_err());
        assert!(validate_selector("   ").is_err());
    }

    #[test]
    fn test_validate_url() {
        assert!(validate_url("https://example.com").is_ok());
        assert!(validate_url("http://localhost:3000").is_ok());

        assert!(validate_url("").is_err());
        assert!(validate_url("ftp://invalid.com").is_err());
        assert!(validate_url("not-a-url").is_err());
    }

    #[test]
    fn test_validate_wait_time() {
        assert!(validate_wait_time(1000).is_ok());
        assert!(validate_wait_time(60000).is_ok());

        assert!(validate_wait_time(0).is_err());
        assert!(validate_wait_time(400000).is_err());
    }
}