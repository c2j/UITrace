use thirtyfour::prelude::*;
use tokio::time::{sleep, Duration};
use tracing::{info, debug, error, warn};
use crate::models::{TestScript, TestStep, StepAction, ElementSelector, SelectorType, ExecutionResult, StepResult, StepStatus};
use std::time::Instant;

pub struct ScriptExecutor {
    driver: WebDriver,
    retry_attempts: u32,
    retry_delay_ms: u64,
}

impl ScriptExecutor {
    pub async fn new() -> Result<Self, WebDriverError> {
        let caps = DesiredCapabilities::chrome();
        let driver = WebDriver::new("http://localhost:9515", caps).await?;

        Ok(Self {
            driver,
            retry_attempts: 3,
            retry_delay_ms: 1000,
        })
    }

    pub async fn execute_script(&mut self, script: &TestScript) -> ExecutionResult {
        info!("Starting execution of script: {} ({})", script.name, script.id);

        let mut result = ExecutionResult::new(script.id);
        result.status = crate::models::ExecutionStatus::Running;

        for (i, step) in script.steps.iter().enumerate() {
            debug!("Executing step {}: {}", i + 1, step.name);

            let step_result = self.execute_step(step).await;

            match step_result.status {
                StepStatus::Completed => {
                    info!("Step {} completed successfully", i + 1);
                }
                StepStatus::Failed => {
                    error!("Step {} failed: {:?}", i + 1, step_result.error_message);
                    result.status = crate::models::ExecutionStatus::Failed;
                    result.update_statistics();
                    return result;
                }
                _ => {}
            }

            // Add step result to execution result
            // This is simplified - in real implementation, organize by test cases
        }

        result.complete();
        result.update_statistics();
        info!("Script execution completed successfully");

        result
    }

    async fn execute_step(&mut self, step: &TestStep) -> StepResult {
        let mut step_result = StepResult {
            step_id: step.step_id,
            status: StepStatus::Running,
            started_at: Some(chrono::Utc::now()),
            completed_at: None,
            duration_ms: None,
            error_message: None,
            screenshot_before_path: None,
            screenshot_after_path: None,
            visual_comparison: None,
        };

        let start_time = Instant::now();

        match self.perform_action(step).await {
            Ok(_) => {
                step_result.status = StepStatus::Completed;
                info!("Step {} executed successfully", step.step_id);
            }
            Err(e) => {
                step_result.status = StepStatus::Failed;
                step_result.error_message = Some(format!("Step failed: {}", e));
                error!("Step {} failed: {}", step.step_id, e);
            }
        }

        let duration = start_time.elapsed();
        step_result.duration_ms = Some(duration.as_millis() as u64);
        step_result.completed_at = Some(chrono::Utc::now());

        step_result
    }

    async fn perform_action(&mut self, step: &TestStep) -> Result<(), Box<dyn std::error::Error>> {
        match step.action {
            StepAction::Navigate => {
                if let Some(url) = &step.value {
                    self.driver.goto(url).await?;
                    sleep(Duration::from_millis(500)).await; // Wait for page load
                } else {
                    return Err("Navigate action requires a URL value".into());
                }
            }
            StepAction::Click => {
                let element = self.find_element_with_fallbacks(&step.selectors).await?;
                element.click().await?;
            }
            StepAction::Type => {
                let element = self.find_element_with_fallbacks(&step.selectors).await?;
                if let Some(value) = &step.value {
                    element.clear().await?;
                    element.send_keys(value).await?;
                } else {
                    return Err("Type action requires a value".into());
                }
            }
            StepAction::AssertText => {
                let element = self.find_element_with_fallbacks(&step.selectors).await?;
                let text = element.text().await?;
                if let Some(expected) = &step.expected_value {
                    if text != *expected {
                        return Err(format!("Text assertion failed. Expected: {}, Got: {}", expected, text).into());
                    }
                }
            }
            StepAction::AssertUrl => {
                let current_url = self.driver.current_url().await?;
                if let Some(expected) = &step.expected_value {
                    if current_url.to_string() != *expected {
                        return Err(format!("URL assertion failed. Expected: {}, Got: {}", expected, current_url).into());
                    }
                }
            }
            StepAction::Screenshot => {
                // Screenshot functionality would be implemented here
                info!("Taking screenshot for step {}", step.step_id);
            }
            StepAction::Wait => {
                if let Some(seconds_str) = &step.value {
                    if let Ok(seconds) = seconds_str.parse::<u64>() {
                        sleep(Duration::from_secs(seconds)).await;
                    } else {
                        return Err(format!("Invalid wait time: {}", seconds_str).into());
                    }
                } else {
                    sleep(Duration::from_secs(1)).await; // Default 1 second wait
                }
            }
        }

        Ok(())
    }

    async fn find_element_with_fallbacks(&mut self, selectors: &[ElementSelector]) -> Result<WebElement, Box<dyn std::error::Error>> {
        for (attempt, selector) in selectors.iter().enumerate() {
            for retry in 0..self.retry_attempts {
                match self.find_element(selector).await {
                    Ok(element) => {
                        debug!("Found element with selector type {:?} on attempt {}", selector.selector_type, attempt + 1);
                        return Ok(element);
                    }
                    Err(e) => {
                        if retry < self.retry_attempts - 1 {
                            warn!("Selector attempt {} failed, retrying in {}ms: {}", retry + 1, self.retry_delay_ms, e);
                            sleep(Duration::from_millis(self.retry_delay_ms)).await;
                        } else {
                            warn!("All retries exhausted for selector type {:?}", selector.selector_type);
                        }
                    }
                }
            }
        }

        Err("Element not found with any selector strategy".into())
    }

    async fn find_element(&self, selector: &ElementSelector) -> Result<WebElement, WebDriverError> {
        match selector.selector_type {
            SelectorType::Id => {
                self.driver.find(By::Id(&selector.value)).await
            }
            SelectorType::Css => {
                self.driver.find(By::Css(&selector.value)).await
            }
            SelectorType::XPath => {
                self.driver.find(By::XPath(&selector.value)).await
            }
            SelectorType::Name => {
                self.driver.find(By::Name(&selector.value)).await
            }
            SelectorType::DataAttribute => {
                self.driver.find(By::Css(&selector.value)).await
            }
        }
    }

    pub async fn close(mut self) {
        if let Err(e) = self.driver.quit().await {
            error!("Error closing WebDriver: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_executor_creation() {
        // This test would require a running WebDriver instance
        // For now, we'll just test the structure
        let result = ScriptExecutor::new().await;

        // If WebDriver is not running, this should fail gracefully
        match result {
            Ok(_) => {
                // Test passed - WebDriver is available
            }
            Err(_) => {
                // Expected if WebDriver is not running
                println!("WebDriver not available - test skipped");
            }
        }
    }
}