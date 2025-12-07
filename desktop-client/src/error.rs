use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Recording error: {0}")]
    RecordingError(String),

    #[error("Script error: {0}")]
    ScriptError(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("WebDriver error: {0}")]
    WebDriverError(String),
}

impl From<thirtyfour::error::WebDriverError> for AppError {
    fn from(error: thirtyfour::error::WebDriverError) -> Self {
        AppError::WebDriverError(error.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;