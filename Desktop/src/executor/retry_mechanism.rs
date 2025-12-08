use std::time::{Duration, Instant};
use rand::Rng;
use crate::models::TestStep;

/// Configuration for retry mechanism
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
    pub timeout_ms: u64,
    pub exponential_backoff: bool,
    pub enable_jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
            timeout_ms: 30000,
            exponential_backoff: true,
            enable_jitter: true,
        }
    }
}

impl RetryConfig {
    /// Validate the retry configuration
    pub fn validate(&self) -> Result<(), String> {
        if self.max_attempts == 0 {
            return Err("Max attempts must be greater than 0".to_string());
        }

        if self.base_delay_ms == 0 {
            return Err("Base delay must be greater than 0".to_string());
        }

        if self.timeout_ms < self.base_delay_ms {
            return Err("Timeout must be greater than or equal to base delay".to_string());
        }

        if self.max_delay_ms < self.base_delay_ms {
            return Err("Max delay must be greater than or equal to base delay".to_string());
        }

        Ok(())
    }
}

/// Retry mechanism with configurable backoff and timeout
pub struct RetryMechanism {
    config: RetryConfig,
    current_attempt: u32,
    start_time: Instant,
}

impl RetryMechanism {
    /// Create a new retry mechanism with the given configuration
    pub fn new(config: RetryConfig) -> Self {
        Self {
            config,
            current_attempt: 0,
            start_time: Instant::now(),
        }
    }

    /// Create a retry mechanism with step-specific context
    pub fn with_step_context(config: RetryConfig, step: &TestStep) -> Self {
        let mut mechanism = Self::new(config);

        // Use step timeout if available and reasonable
        if step.timeout_seconds > 0 && (step.timeout_seconds as u64 * 1000) > mechanism.config.base_delay_ms {
            mechanism.config.timeout_ms = step.timeout_seconds as u64 * 1000;
        }

        mechanism
    }

    /// Get the current retry configuration
    pub fn get_config(&self) -> &RetryConfig {
        &self.config
    }

    /// Get the current attempt number
    pub fn get_current_attempt(&self) -> u32 {
        self.current_attempt
    }

    /// Check if we should retry based on attempt count
    pub fn should_retry(&self) -> bool {
        self.current_attempt < self.config.max_attempts
    }

    /// Check if we should continue (not timed out)
    pub fn should_continue(&self) -> bool {
        !self.is_timed_out()
    }

    /// Check if the retry mechanism has timed out
    pub fn is_timed_out(&self) -> bool {
        self.start_time.elapsed().as_millis() as u64 > self.config.timeout_ms
    }

    /// Increment the attempt counter
    pub fn increment_attempt(&mut self) {
        self.current_attempt += 1;
    }

    /// Reset the retry mechanism
    pub fn reset(&mut self) {
        self.current_attempt = 0;
        self.start_time = Instant::now();
    }

    /// Calculate delay for the given attempt number
    pub fn calculate_delay(&self, attempt: u32) -> Duration {
        let delay_ms = if self.config.exponential_backoff {
            // Exponential backoff: base_delay * 2^(attempt-1)
            self.config.base_delay_ms * 2_u64.pow(attempt.saturating_sub(1))
        } else {
            // Linear backoff: base_delay * attempt
            self.config.base_delay_ms * attempt as u64
        };

        // Apply maximum delay cap
        let delay_ms = delay_ms.min(self.config.max_delay_ms);

        Duration::from_millis(delay_ms)
    }

    /// Calculate delay with jitter for the current attempt
    pub fn calculate_delay_with_jitter(&self, attempt: u32) -> Duration {
        let base_delay = self.calculate_delay(attempt);

        if !self.config.enable_jitter {
            return base_delay;
        }

        // Add jitter: ±25% randomization
        let mut rng = rand::thread_rng();
        let jitter_factor = rng.gen_range(0.75..=1.25);
        let jittered_delay = base_delay.as_millis() as f64 * jitter_factor;

        Duration::from_millis(jittered_delay as u64)
    }

    /// Execute an async operation with retry logic
    pub async fn execute_with_retry<F, Fut, T, E>(
        &mut self,
        mut operation: F,
    ) -> Result<T, E>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
    {
        self.reset();

        loop {
            if !self.should_continue() {
                return operation().await; // Final attempt, even if timed out
            }

            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    self.increment_attempt();

                    if !self.should_retry() {
                        return Err(e);
                    }

                    if self.should_continue() {
                        let delay = self.calculate_delay_with_jitter(self.current_attempt);
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }
    }

    /// Execute an operation with retry logic and custom error handling
    pub async fn execute_with_retry_and_handler<F, Fut, T, E, H>(
        &mut self,
        mut operation: F,
        mut error_handler: H,
    ) -> Result<T, E>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
        H: FnMut(&E, u32) -> bool, // Error handler: return true to continue retrying
    {
        self.reset();

        loop {
            if !self.should_continue() {
                return operation().await;
            }

            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    self.increment_attempt();

                    if !error_handler(&e, self.current_attempt) || !self.should_retry() {
                        return Err(e);
                    }

                    if self.should_continue() {
                        let delay = self.calculate_delay_with_jitter(self.current_attempt);
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TestStep;

    #[test]
    fn test_retry_config_validation() {
        let valid_config = RetryConfig::default();
        assert!(valid_config.validate().is_ok());

        let invalid_config = RetryConfig {
            max_attempts: 0,
            ..Default::default()
        };
        assert!(invalid_config.validate().is_err());
    }

    #[test]
    fn test_retry_mechanism_creation() {
        let config = RetryConfig::default();
        let mechanism = RetryMechanism::new(config.clone());

        assert_eq!(mechanism.get_config().max_attempts, config.max_attempts);
        assert_eq!(mechanism.get_current_attempt(), 0);
        assert!(!mechanism.is_timed_out());
    }

    #[test]
    fn test_retry_delay_calculation() {
        let config = RetryConfig {
            max_attempts: 5,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
            timeout_ms: 60000,
            exponential_backoff: true,
            ..Default::default()
        };

        let mechanism = RetryMechanism::new(config);

        let delay1 = mechanism.calculate_delay(1);
        let delay2 = mechanism.calculate_delay(2);
        let delay3 = mechanism.calculate_delay(3);

        assert!(delay2 > delay1);
        assert!(delay3 > delay2);

        // Test maximum delay cap
        let delay10 = mechanism.calculate_delay(10);
        assert!(delay10.as_millis() as u64 <= 30000);
    }

    #[tokio::test]
    async fn test_async_retry_execution() {
        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 100,
            max_delay_ms: 1000,
            timeout_ms: 5000,
            exponential_backoff: false,
            ..Default::default()
        };

        let mut mechanism = RetryMechanism::new(config);
        let mut attempt_count = 0;

        let result = mechanism.execute_with_retry(|| {
            attempt_count += 1;
            async move {
                if attempt_count < 3 {
                    Err(format!("Attempt {} failed", attempt_count))
                } else {
                    Ok("Success on third attempt")
                }
            }
        }).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Success on third attempt");
        assert_eq!(attempt_count, 3);
    }
}