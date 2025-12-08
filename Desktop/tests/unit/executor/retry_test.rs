use std::time::Duration;
use uitrace_desktop::executor::retry_mechanism::{RetryMechanism, RetryConfig};
use uitrace_desktop::models::{TestStep, Selector};

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[test]
    fn test_retry_config_validation() {
        // Valid config
        let valid_config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
            timeout_ms: 5000,
            exponential_backoff: true,
        };

        assert!(valid_config.validate().is_ok());

        // Invalid config - zero attempts
        let invalid_config1 = RetryConfig {
            max_attempts: 0,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
            timeout_ms: 5000,
            exponential_backoff: true,
        };

        assert!(invalid_config1.validate().is_err());

        // Invalid config - negative timeout
        let invalid_config2 = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
            timeout_ms: -1,
            exponential_backoff: true,
        };

        assert!(invalid_config2.validate().is_err());
    }

    #[test]
    fn test_retry_mechanism_creation() {
        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
            timeout_ms: 10000,
            exponential_backoff: true,
        };

        let retry_mechanism = RetryMechanism::new(config);

        assert_eq!(retry_mechanism.get_config().max_attempts, 3);
        assert_eq!(retry_mechanism.get_config().base_delay_ms, 1000);
        assert!(!retry_mechanism.is_timed_out());
    }

    #[test]
    fn test_retry_delay_calculation() {
        let config = RetryConfig {
            max_attempts: 5,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
            timeout_ms: 60000,
            exponential_backoff: true,
        };

        let retry_mechanism = RetryMechanism::new(config);

        // Test exponential backoff
        let delay1 = retry_mechanism.calculate_delay(1);
        let delay2 = retry_mechanism.calculate_delay(2);
        let delay3 = retry_mechanism.calculate_delay(3);

        assert!(delay2 > delay1);
        assert!(delay3 > delay2);

        // Test maximum delay cap
        let delay10 = retry_mechanism.calculate_delay(10);
        assert!(delay10 <= Duration::from_millis(30000));
    }

    #[test]
    fn test_retry_attempt_tracking() {
        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 100,
            max_delay_ms: 1000,
            timeout_ms: 5000,
            exponential_backoff: false,
        };

        let mut retry_mechanism = RetryMechanism::new(config);

        assert_eq!(retry_mechanism.get_current_attempt(), 0);
        assert!(!retry_mechanism.should_retry());

        // First attempt
        retry_mechanism.increment_attempt();
        assert_eq!(retry_mechanism.get_current_attempt(), 1);
        assert!(retry_mechanism.should_retry());

        // Second attempt
        retry_mechanism.increment_attempt();
        assert_eq!(retry_mechanism.get_current_attempt(), 2);
        assert!(retry_mechanism.should_retry());

        // Third attempt - should still retry (last attempt)
        retry_mechanism.increment_attempt();
        assert_eq!(retry_mechanism.get_current_attempt(), 3);
        assert!(retry_mechanism.should_retry());

        // Fourth attempt - should not retry
        retry_mechanism.increment_attempt();
        assert_eq!(retry_mechanism.get_current_attempt(), 4);
        assert!(!retry_mechanism.should_retry());
    }

    #[test]
    fn test_timeout_detection() {
        let config = RetryConfig {
            max_attempts: 10,
            base_delay_ms: 100,
            max_delay_ms: 1000,
            timeout_ms: 500, // 500ms timeout
            exponential_backoff: false,
        };

        let mut retry_mechanism = RetryMechanism::new(config);

        assert!(!retry_mechanism.is_timed_out());

        // Simulate time passing
        std::thread::sleep(Duration::from_millis(600));

        assert!(retry_mechanism.is_timed_out());
        assert!(!retry_mechanism.should_continue());
    }

    #[test]
    fn test_reset_functionality() {
        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 1000,
            max_delay_ms: 10000,
            timeout_ms: 30000,
            exponential_backoff: true,
        };

        let mut retry_mechanism = RetryMechanism::new(config);

        // Simulate some attempts
        retry_mechanism.increment_attempt();
        retry_mechanism.increment_attempt();
        assert_eq!(retry_mechanism.get_current_attempt(), 2);

        // Reset
        retry_mechanism.reset();
        assert_eq!(retry_mechanism.get_current_attempt(), 0);
        assert!(retry_mechanism.should_retry());
        assert!(!retry_mechanism.is_timed_out());
    }

    #[tokio::test]
    async fn test_async_retry_execution() {
        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 100,
            max_delay_ms: 1000,
            timeout_ms: 5000,
            exponential_backoff: false,
        };

        let retry_mechanism = RetryMechanism::new(config);
        let mut attempt_count = 0;

        let result = retry_mechanism.execute_with_retry(|| {
            attempt_count += 1;
            if attempt_count < 3 {
                Err(format!("Attempt {} failed", attempt_count))
            } else {
                Ok("Success on third attempt")
            }
        }).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Success on third attempt");
        assert_eq!(attempt_count, 3);
    }

    #[tokio::test]
    async fn test_retry_with_step_context() {
        let step = TestStep::new(1, "Click button".to_string(), "click".to_string())
            .with_timeout(5)
            .add_selector("id".to_string(), "#submit".to_string(), 1);

        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 100,
            max_delay_ms: 1000,
            timeout_ms: 5000,
            exponential_backoff: true,
        };

        let retry_mechanism = RetryMechanism::with_step_context(config, &step);

        assert_eq!(retry_mechanism.get_config().timeout_ms, 5000);
        assert!(retry_mechanism.should_retry());
    }

    #[test]
    fn test_jitter_calculation() {
        let config = RetryConfig {
            max_attempts: 5,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
            timeout_ms: 60000,
            exponential_backoff: true,
        };

        let retry_mechanism = RetryMechanism::new(config);

        // Test jitter adds randomness
        let delay1 = retry_mechanism.calculate_delay_with_jitter(2);
        let delay2 = retry_mechanism.calculate_delay_with_jitter(2);
        let delay3 = retry_mechanism.calculate_delay_with_jitter(2);

        // All delays should be in the same ballpark but not identical
        assert!(delay1.as_millis() > 0);
        assert!(delay2.as_millis() > 0);
        assert!(delay3.as_millis() > 0);

        // They should all be within reasonable range (±50% of expected)
        let expected = Duration::from_millis(2000); // 2 seconds for attempt 2
        let tolerance = Duration::from_millis(1000);

        assert!(delay1 >= expected - tolerance && delay1 <= expected + tolerance);
        assert!(delay2 >= expected - tolerance && delay2 <= expected + tolerance);
        assert!(delay3 >= expected - tolerance && delay3 <= expected + tolerance);
    }

    #[test]
    fn test_custom_retry_strategy() {
        let config = RetryConfig {
            max_attempts: 5,
            base_delay_ms: 500,
            max_delay_ms: 20000,
            timeout_ms: 30000,
            exponential_backoff: false, // Linear backoff
        };

        let retry_mechanism = RetryMechanism::new(config);

        let delay1 = retry_mechanism.calculate_delay(1);
        let delay2 = retry_mechanism.calculate_delay(2);
        let delay3 = retry_mechanism.calculate_delay(3);

        // Linear backoff: each delay should be base_delay * attempt
        assert_eq!(delay1, Duration::from_millis(500));
        assert_eq!(delay2, Duration::from_millis(1000));
        assert_eq!(delay3, Duration::from_millis(1500));
    }
}