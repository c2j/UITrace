use thiserror::Error;
use std::error::Error as StdError;
use thirtyfour::error::WebDriverError;

#[derive(Error, Debug)]
pub enum UITraceError {
    #[error("Recording error: {0}")]
    Recording(String),

    #[error("Execution error: {0}")]
    Execution(String),

    #[error("Data error: {0}")]
    Data(String),

    #[error("Visual comparison error: {0}")]
    Visual(String),

    #[error("Project error: {0}")]
    Project(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("WebDriver error: {0}")]
    WebDriver(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<serde_json::Error> for UITraceError {
    fn from(error: serde_json::Error) -> Self {
        UITraceError::Serialization(error.to_string())
    }
}

impl From<WebDriverError> for UITraceError {
    fn from(error: WebDriverError) -> Self {
        UITraceError::WebDriver(error.to_string())
    }
}

impl From<crate::utils::file_utils::FileError> for UITraceError {
    fn from(error: crate::utils::file_utils::FileError) -> Self {
        UITraceError::Io(error.into())
    }
}

pub struct ErrorHandler;

impl ErrorHandler {
    pub fn new() -> Self {
        Self
    }

    pub fn handle_error(&self, error: &UITraceError) -> String {
        match error {
            UITraceError::Recording(msg) => format!("Recording failed: {}", msg),
            UITraceError::Execution(msg) => format!("Execution failed: {}", msg),
            UITraceError::Data(msg) => format!("Data operation failed: {}", msg),
            UITraceError::Visual(msg) => format!("Visual comparison failed: {}", msg),
            UITraceError::Project(msg) => format!("Project operation failed: {}", msg),
            UITraceError::Io(err) => format!("IO error: {}", err),
            UITraceError::Serialization(msg) => format!("Serialization failed: {}", msg),
            UITraceError::WebDriver(msg) => format!("WebDriver error: {}", msg),
            UITraceError::Config(msg) => format!("Configuration error: {}", msg),
            UITraceError::Validation(msg) => format!("Validation failed: {}", msg),
            UITraceError::Network(msg) => format!("Network error: {}", msg),
            UITraceError::Internal(msg) => format!("Internal error: {}", msg),
        }
    }

    pub fn is_recoverable(&self, error: &UITraceError) -> bool {
        match error {
            UITraceError::Network(_) | UITraceError::WebDriver(_) => true,
            UITraceError::Io(_) => {
                // Check if it's a temporary IO error
                if let Some(io_err) = error.source() {
                    if let Some(io_err) = io_err.downcast_ref::<std::io::Error>() {
                        match io_err.kind() {
                            std::io::ErrorKind::ConnectionReset |
                            std::io::ErrorKind::ConnectionRefused |
                            std::io::ErrorKind::TimedOut => true,
                            _ => false,
                        }
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    pub fn get_retry_delay(&self, error: &UITraceError) -> Option<std::time::Duration> {
        match error {
            UITraceError::Network(_) => Some(std::time::Duration::from_secs(5)),
            UITraceError::WebDriver(_) => Some(std::time::Duration::from_secs(2)),
            _ => None,
        }
    }
}

impl Default for ErrorHandler {
    fn default() -> Self {
        Self::new()
    }
}