use std::time::Duration;

pub struct RetryMechanism {
    max_attempts: u32,
    base_delay: Duration,
    max_delay: Duration,
}

impl RetryMechanism {
    pub fn new(max_attempts: u32, base_delay: Duration, max_delay: Duration) -> Self {
        Self {
            max_attempts,
            base_delay,
            max_delay,
        }
    }

    pub async fn execute_with_retry<F, T, E>(
        &self,
        mut operation: F,
    ) -> Result<T, E>
    where
        F: FnMut() -> Result<T, E>,
    {
        let mut attempts = 0;
        loop {
            attempts += 1;
            match operation() {
                Ok(result) => return Ok(result),
                Err(_e) if attempts < self.max_attempts => {
                    let delay = self.calculate_delay(attempts);
                    tokio::time::sleep(delay).await;
                }
                Err(e) => return Err(e),
            }
        }
    }

    fn calculate_delay(&self,
        attempt: u32,
    ) -> Duration {
        let delay = self.base_delay * 2_u32.pow(attempt - 1);
        delay.min(self.max_delay)
    }
}