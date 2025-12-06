use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingConfig {
    /// Whether to capture console logs
    pub capture_console: bool,
    /// Whether to capture network requests
    pub capture_network: bool,
    /// Whether to capture screenshots after each action
    pub capture_screenshots: bool,
    /// Maximum wait time for element detection (ms)
    pub element_timeout: u64,
    /// Recording metadata
    pub metadata: Value,
    /// Whether to record hover events
    pub record_hovers: bool,
    /// Whether to record scroll events
    pub record_scrolls: bool,
    /// Debounce time for input events (ms)
    pub input_debounce: u64,
}

impl Default for RecordingConfig {
    fn default() -> Self {
        Self {
            capture_console: true,
            capture_network: false,
            capture_screenshots: false,
            element_timeout: 5000,
            metadata: Value::Object(Default::default()),
            record_hovers: false,
            record_scrolls: true,
            input_debounce: 300,
        }
    }
}