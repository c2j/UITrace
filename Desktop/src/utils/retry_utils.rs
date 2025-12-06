use std::time::Duration;
use tokio::time::sleep;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RetryError<E> {
    #[error("Operation failed after {attempts} attempts")]
    Exhausted {
        attempts: u32,
        last_error: E,
    },
}

pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub multiplier: f64,
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(1000),
            max_delay: Duration::from_secs(30),
            multiplier: 2.0,
            jitter: true,
        }
    }
}

pub struct RetryUtils;

impl RetryUtils {
    pub fn new() -> Self {
        Self
    }

    /// Execute an operation with exponential backoff retry
    pub async fn retry_with_exponential_backoff<F, T, E, Fut>(
        config: RetryConfig,
        mut operation: F,
    ) -> Result<T, RetryError<E>>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
        E: std::fmt::Display + Clone,
    {
        let mut delay = config.initial_delay;
        let mut last_error: Option<E> = None;

        for attempt in 1..=config.max_attempts {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(error) => {
                    last_error = Some(error);

                    if attempt < config.max_attempts {
                        // Add jitter if enabled
                        let actual_delay = if config.jitter {
                            let jitter_factor = 0.1;
                            let jitter_ms = (delay.as_millis() as f64 * jitter_factor) as i64;
                            let jitter = rand::random::<i64>() % (jitter_ms * 2 + 1) - jitter_ms;
                            Duration::from_millis((delay.as_millis() as i64 + jitter) as u64)
                        } else {
                            delay
                        };

                        sleep(actual_delay).await;

                        // Exponential backoff
                        delay = std::cmp::min(
                            Duration::from_millis((delay.as_millis() as f64 * config.multiplier) as u64),
                            config.max_delay,
                        );
                    }
                }
            }
        }

        Err(RetryError::Exhausted {
            attempts: config.max_attempts,
            last_error: last_error.unwrap(),
        })
    }

    /// Execute with fixed delay between attempts
    pub async fn retry_with_fixed_delay<F, T, E, Fut>(
        max_attempts: u32,
        delay: Duration,
        mut operation: F,
    ) -> Result<T, RetryError<E>>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
        E: std::fmt::Display + Clone,
    {
        let config = RetryConfig {
            max_attempts,
            initial_delay: delay,
            max_delay: delay,
            multiplier: 1.0,
            jitter: false,
        };

        Self::retry_with_exponential_backoff(config, operation).await
    }

    /// Execute with custom retry condition
    pub async fn retry_with_condition<F, T, E, C, Fut>(
        config: RetryConfig,
        mut operation: F,
        mut should_retry: C,
    ) -> Result<T, RetryError<E>>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
        C: FnMut(&E) -> bool,
        E: std::fmt::Display + Clone,
    {
        let mut delay = config.initial_delay;
        let mut last_error: Option<E> = None;

        for attempt in 1..=config.max_attempts {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(error) => {
                    last_error = Some(error.clone());

                    if attempt < config.max_attempts && should_retry(&error) {
                        sleep(delay).await;

                        // Exponential backoff
                        delay = std::cmp::min(
                            Duration::from_millis((delay.as_millis() as f64 * config.multiplier) as u64),
                            config.max_delay,
                        );
                    }
                }
            }
        }

        Err(RetryError::Exhausted {
            attempts: config.max_attempts,
            last_error: last_error.unwrap(),
        })
    }

    /// Execute operation with immediate retries (no delay)
    pub async fn retry_immediately<F, T, E, Fut>(
        max_attempts: u32,
        mut operation: F,
    ) -> Result<T, RetryError<E>>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
        E: std::fmt::Display + Clone,
    {
        let mut last_error: Option<E> = None;

        for attempt in 1..=max_attempts {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(error) => {
                    last_error = Some(error);
                    if attempt < max_attempts {
                        // No delay, just continue
                    }
                }
            }
        }

        Err(RetryError::Exhausted {
            attempts: max_attempts,
            last_error: last_error.unwrap(),
        })
    }

    /// Create a retry configuration for UI testing
    pub fn ui_test_retry_config() -> RetryConfig {
        RetryConfig {
            max_attempts: 5,
            initial_delay: Duration::from_millis(500),
            max_delay: Duration::from_secs(10),
            multiplier: 1.5,
            jitter: true,
        }
    }

    /// Create a retry configuration for network operations
    pub fn network_retry_config() -> RetryConfig {
        RetryConfig {
            max_attempts: 3,
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(30),
            multiplier: 2.0,
            jitter: true,
        }
    }

    /// Create a retry configuration for file operations
    pub fn file_operation_retry_config() -> RetryConfig {
        RetryConfig {
            max_attempts: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(1),
            multiplier: 2.0,
            jitter: false,
        }
    }
}

impl Default for RetryUtils {
    fn default() -> Self {
        Self::new()
    }
}