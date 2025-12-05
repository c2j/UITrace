use tracing::{info, debug, error};
use std::path::Path;
use uuid::Uuid;
use chrono::Utc;

pub mod config;
pub mod logging;
pub mod validation;

pub use config::*;
pub use logging::*;
pub use validation::*;

pub fn ensure_directory_exists(path: &str) -> Result<(), Box<dyn std::error::Error>> {
    if !Path::new(path).exists() {
        std::fs::create_dir_all(path)?;
        info!("Created directory: {}", path);
    }
    Ok(())
}

pub fn generate_timestamped_filename(prefix: &str, extension: &str) -> String {
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    format!("{}_{}.{}", prefix, timestamp, extension)
}

pub fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | '?' | '%' | '*' | ':' | '|' | '"' | '<' | '>' | ' ' => {
                '_'
            }
            _ => c,
        })
        .collect()
}

pub fn format_duration(millis: u64) -> String {
    if millis < 1000 {
        format!("{}ms", millis)
    } else if millis < 60000 {
        format!("{:.2}s", millis as f64 / 1000.0)
    } else {
        let minutes = millis / 60000;
        let seconds = (millis % 60000) / 1000;
        format!("{}m {}s", minutes, seconds)
    }
}

pub fn generate_unique_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn truncate_string(s: &str, max_length: usize) -> String {
    if s.len() <= max_length {
        s.to_string()
    } else {
        format!("{}...", &s[..max_length.saturating_sub(3)])
    }
}

pub fn parse_url(url: &str) -> Result<url::Url, Box<dyn std::error::Error>> {
    let parsed = url::Url::parse(url)?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!("Invalid URL scheme: {}. Only HTTP and HTTPS are supported.", parsed.scheme()).into());
    }

    Ok(parsed)
}

pub fn is_valid_email(email: &str) -> bool {
    email.contains('@') && email.contains('.') && !email.starts_with('@') && !email.ends_with('@')
}

pub fn is_valid_selector(selector: &str) -> bool {
    !selector.trim().is_empty() && selector.len() <= 1000 // Reasonable length limit
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("test/file:name.txt"), "test_file_name.txt");
        assert_eq!(sanitize_filename("normal_filename"), "normal_filename");
        assert_eq!(sanitize_filename("file with spaces"), "file_with_spaces");
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(500), "500ms");
        assert_eq!(format_duration(1500), "1.50s");
        assert_eq!(format_duration(65000), "1m 5s");
    }

    #[test]
    fn test_truncate_string() {
        assert_eq!(truncate_string("Hello World", 5), "He...");
        assert_eq!(truncate_string("Hi", 5), "Hi");
        assert_eq!(truncate_string("Test", 4), "Test");
    }

    #[test]
    fn test_is_valid_email() {
        assert!(is_valid_email("test@example.com"));
        assert!(is_valid_email("user.name@domain.co.uk"));
        assert!(!is_valid_email("invalid.email"));
        assert!(!is_valid_email("@example.com"));
        assert!(!is_valid_email("test@"));
    }

    #[test]
    fn test_is_valid_selector() {
        assert!(is_valid_selector("#myId"));
        assert!(is_valid_selector(".myClass"));
        assert!(is_valid_selector("button"));
        assert!(!is_valid_selector(""));
        assert!(!is_valid_selector("   "));
    }
}