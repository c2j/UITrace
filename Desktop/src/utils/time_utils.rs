use chrono::{DateTime, Duration, Utc};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TimeError {
    #[error("Invalid time format: {0}")]
    InvalidFormat(String),
    #[error("Time conversion error")]
    ConversionError,
}

pub struct TimeUtils;

impl TimeUtils {
    pub fn new() -> Self {
        Self
    }

    /// Get current timestamp as Unix epoch in milliseconds
    pub fn now_timestamp_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    /// Get current timestamp as Unix epoch in seconds
    pub fn now_timestamp_s() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    /// Convert timestamp to human-readable format
    pub fn format_timestamp(timestamp: u64) -> String {
        let dt = DateTime::from_timestamp(timestamp as i64, 0)
            .unwrap_or_else(|| Utc::now());
        dt.format("%Y-%m-%d %H:%M:%S UTC").to_string()
    }

    /// Parse human-readable date string to timestamp
    pub fn parse_date_string(date_str: &str) -> Result<u64, TimeError> {
        let formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S UTC",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d",
        ];

        for format in &formats {
            if let Ok(dt) = DateTime::parse_from_str(date_str, format) {
                return Ok(dt.timestamp() as u64);
            } else if let Ok(dt) = DateTime::parse_from_str(&format!("{}Z", date_str), format) {
                return Ok(dt.timestamp() as u64);
            }
        }

        Err(TimeError::InvalidFormat(date_str.to_string()))
    }

    /// Format duration in human-readable format
    pub fn format_duration(duration: Duration) -> String {
        let total_seconds = duration.num_seconds();
        let days = total_seconds / 86400;
        let hours = (total_seconds % 86400) / 3600;
        let minutes = (total_seconds % 3600) / 60;
        let seconds = total_seconds % 60;

        let mut parts = Vec::new();

        if days > 0 {
            parts.push(format!("{}d", days));
        }
        if hours > 0 {
            parts.push(format!("{}h", hours));
        }
        if minutes > 0 {
            parts.push(format!("{}m", minutes));
        }
        if seconds > 0 || parts.is_empty() {
            parts.push(format!("{}s", seconds));
        }

        parts.join(" ")
    }

    /// Format duration from milliseconds
    pub fn format_duration_ms(ms: i64) -> String {
        let duration = Duration::milliseconds(ms);
        Self::format_duration(duration)
    }

    /// Calculate elapsed time since timestamp
    pub fn elapsed_since(timestamp: u64) -> Duration {
        let now = Self::now_timestamp_s() as i64;
        let then = timestamp as i64;
        Duration::seconds(now - then)
    }

    /// Check if timestamp is within the last N seconds
    pub fn is_within_last(timestamp: u64, seconds: i64) -> bool {
        let elapsed = Self::elapsed_since(timestamp);
        elapsed.num_seconds() < seconds
    }

    /// Generate time-based filename prefix
    pub fn generate_filename_timestamp() -> String {
        Utc::now().format("%Y%m%d_%H%M%S").to_string()
    }

    /// Sleep for specified duration with early wake-up capability
    pub async fn sleep_with_timeout(duration: Duration, early_wake: tokio::sync::oneshot::Receiver<()>) {
        tokio::select! {
            _ = tokio::time::sleep(duration.to_std().unwrap_or(std::time::Duration::MAX)) => {
                // Normal sleep completed
            }
            _ = early_wake => {
                // Early wake-up requested
            }
        }
    }

    /// Measure execution time of an async operation
    pub async fn measure_async<F, T, Fut>(operation: F) -> (T, Duration)
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = T>,
    {
        let start = Utc::now();
        let result = operation().await;
        let end = Utc::now();
        (result, end - start)
    }

    /// Create a timeout for an operation
    pub async fn with_timeout<F, T, Fut>(
        duration: Duration,
        operation: F,
    ) -> Result<T, &'static str>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = T>,
    {
        tokio::time::timeout(duration.to_std().unwrap_or(std::time::Duration::MAX), operation())
            .await
            .map_err(|_| "Operation timed out")
    }

    }

/// Rate limiter - ensure minimum time between calls
pub struct RateLimiter {
    min_interval: std::time::Duration,
    last_call: std::sync::Mutex<SystemTime>,
}

impl RateLimiter {
    pub fn new(min_interval: Duration) -> Self {
        Self {
            min_interval: min_interval.to_std().unwrap_or_default(),
            last_call: std::sync::Mutex::new(SystemTime::UNIX_EPOCH),
        }
    }

    pub async fn wait(&self) {
        let mut last_call = self.last_call.lock().unwrap();
        let elapsed = last_call.elapsed().unwrap_or_default();

        if elapsed < self.min_interval {
            tokio::time::sleep(self.min_interval - elapsed).await;
        }

        *last_call = SystemTime::now();
    }
}

impl Default for TimeUtils {
    fn default() -> Self {
        Self::new()
    }
}