use crate::models::TestStep;
use crate::models::selector::Selector;
use crate::executor::webdriver_client::{WebDriverClient, WebDriverError};
use crate::executor::selector_fallback::{SelectorFallback, SelectorFallbackError};
use crate::executor::retry_mechanism::RetryMechanism;
use crate::models::execution::{StepResult, ExecutionStatus};
use std::time::Duration;
use thiserror::Error;
use log::{debug, info, warn, error};
use serde_json::Value;

#[derive(Error, Debug)]
pub enum InteractionError {
    #[error("Invalid step configuration: {0}")]
    InvalidConfiguration(String),
    #[error("Element not found: {0}")]
    ElementNotFound(String),
    #[error("Interaction failed: {action} on {selector} - {reason}")]
    InteractionFailed { action: String, selector: String, reason: String },
    #[error("Timeout waiting for element: {selector}")]
    Timeout { selector: String },
    #[error("WebDriver error: {0}")]
    WebDriver(#[from] WebDriverError),
    #[error("Selector fallback error: {0}")]
    SelectorFallback(#[from] SelectorFallbackError),
    #[error("Unsupported action: {0}")]
    UnsupportedAction(String),
    #[error("Invalid wait duration: {0}")]
    InvalidWaitDuration(String),
}

pub struct ElementInteraction<'a> {
    client: &'a WebDriverClient,
    retry_mechanism: RetryMechanism,
}

impl<'a> ElementInteraction<'a> {
    pub fn new(
        client: &'a WebDriverClient,
        max_retries: u32,
        base_delay: Duration,
        max_delay: Duration,
    ) -> Self {
        let retry_mechanism = RetryMechanism::new(max_retries, base_delay, max_delay);
        Self {
            client,
            retry_mechanism,
        }
    }

    /// Execute a test step with fault tolerance
    pub async fn execute_step(&self, step: &TestStep) -> Result<StepResult, InteractionError> {
        let mut step_result = StepResult {
            step_index: step.sequence as usize,
            step_type: step.action.clone(),
            description: step.description.clone(),
            status: ExecutionStatus::Running,
            started_at: chrono::Utc::now(),
            ended_at: None,
            error: None,
            screenshot: None,
            retry_count: 0,
            selector_used: None,
            execution_time_ms: 0,
        };

        info!("Executing step {}: {}", step.sequence, step.description);

        let start_time = std::time::Instant::now();

        // Execute the step with retry mechanism
        let result = self.retry_mechanism.execute_with_retry(|| {
            // Convert async operation to sync for retry mechanism
            let future = self.execute_single_attempt(step);
            futures::executor::block_on(future)
        }).await;

        let execution_time = start_time.elapsed();

        match result {
            Ok(_) => {
                step_result.status = ExecutionStatus::Completed;
                info!("Step {} completed successfully in {:?}", step.sequence, execution_time);
            }
            Err(e) => {
                step_result.status = ExecutionStatus::Failed;
                step_result.error = Some(e.to_string());
                error!("Step {} failed: {}", step.sequence, e);
            }
        }

        step_result.ended_at = Some(chrono::Utc::now());
        step_result.execution_time_ms = execution_time.as_millis() as u64;

        Ok(step_result)
    }

    /// Execute a single attempt of the step
    async fn execute_single_attempt(&self, step: &TestStep) -> Result<(), InteractionError> {
        match step.action.as_str() {
            "navigate" => self.execute_navigate(step).await,
            "click" => self.execute_click(step).await,
            "type" => self.execute_type(step).await,
            "wait" => self.execute_wait(step).await,
            "screenshot" => self.execute_screenshot(step).await,
            "scroll" => self.execute_scroll(step).await,
            "hover" => self.execute_hover(step).await,
            "select" => self.execute_select(step).await,
            "check" => self.execute_check(step).await,
            "uncheck" => self.execute_uncheck(step).await,
            "upload" => self.execute_upload(step).await,
            "execute_script" => self.execute_script(step).await,
            action => Err(InteractionError::UnsupportedAction(action.to_string())),
        }
    }

    /// Navigate to a URL
    async fn execute_navigate(&self, step: &TestStep) -> Result<(), InteractionError> {
        let url = step.value.as_ref()
            .ok_or_else(|| InteractionError::InvalidConfiguration(
                "Navigate step requires a URL value".to_string()
            ))?;

        self.client.navigate(url).await?;
        debug!("Navigated to: {}", url);
        Ok(())
    }

    /// Click on an element
    async fn execute_click(&self, step: &TestStep) -> Result<(), InteractionError> {
        if step.selectors.is_empty() {
            return Err(InteractionError::InvalidConfiguration(
                "Click step requires at least one selector".to_string()
            ));
        }

        let selector_fallback = SelectorFallback::new(self.client);
        let element = selector_fallback.find_element_with_fallback(&step.selectors).await?;

        self.client.click_element(element).await?;
        debug!("Clicked element successfully");
        Ok(())
    }

    /// Type text into an element
    async fn execute_type(&self, step: &TestStep) -> Result<(), InteractionError> {
        if step.selectors.is_empty() {
            return Err(InteractionError::InvalidConfiguration(
                "Type step requires at least one selector".to_string()
            ));
        }

        let text = step.value.as_ref()
            .ok_or_else(|| InteractionError::InvalidConfiguration(
                "Type step requires a text value".to_string()
            ))?;

        let selector_fallback = SelectorFallback::new(self.client);
        let element = selector_fallback.find_element_with_fallback(&step.selectors).await?;

        self.client.type_text(element, text).await?;
        debug!("Typed '{}' into element", text);
        Ok(())
    }

    /// Wait for a specified duration
    async fn execute_wait(&self, step: &TestStep) -> Result<(), InteractionError> {
        let duration_ms = step.value.as_ref()
            .and_then(|v| v.parse::<u64>().ok())
            .ok_or_else(|| InteractionError::InvalidWaitDuration(
                "Wait step requires a valid duration in milliseconds".to_string()
            ))?;

        let duration = Duration::from_millis(duration_ms);
        tokio::time::sleep(duration).await;
        debug!("Waited for {}ms", duration_ms);
        Ok(())
    }

    /// Take a screenshot
    async fn execute_screenshot(&self, _step: &TestStep) -> Result<(), InteractionError> {
        let _screenshot = self.client.take_screenshot().await?;
        debug!("Screenshot captured");
        Ok(())
    }

    /// Scroll the page or element
    async fn execute_scroll(&self, step: &TestStep) -> Result<(), InteractionError> {
        // Parse scroll coordinates from metadata
        let x = step.metadata.get("scroll_x")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as i64;

        let y = step.metadata.get("scroll_y")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as i64;

        let script = format!("window.scrollTo({}, {});", x, y);
        self.client.execute_script(&script, vec![]).await?;
        debug!("Scrolled to ({}, {})", x, y);
        Ok(())
    }

    /// Hover over an element
    async fn execute_hover(&self, step: &TestStep) -> Result<(), InteractionError> {
        if step.selectors.is_empty() {
            return Err(InteractionError::InvalidConfiguration(
                "Hover step requires at least one selector".to_string()
            ));
        }

        let selector_fallback = SelectorFallback::new(self.client);
        let element = selector_fallback.find_element_with_fallback(&step.selectors).await?;

        // Move mouse to element
        let script = r#"
            var rect = arguments[0].getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            return {x: x, y: y};
        "#;

        let coords = self.client.execute_script(script, vec![]).await?;
        debug!("Hovered over element");
        Ok(())
    }

    /// Select an option from a dropdown
    async fn execute_select(&self, step: &TestStep) -> Result<(), InteractionError> {
        if step.selectors.is_empty() {
            return Err(InteractionError::InvalidConfiguration(
                "Select step requires at least one selector".to_string()
            ));
        }

        let option_value = step.value.as_ref()
            .ok_or_else(|| InteractionError::InvalidConfiguration(
                "Select step requires an option value".to_string()
            ))?;

        let selector_fallback = SelectorFallback::new(self.client);
        let element = selector_fallback.find_element_with_fallback(&step.selectors).await?;

        // Use JavaScript to select the option
        let script = format!(r#"
            var select = arguments[0];
            for (var i = 0; i < select.options.length; i++) {{
                if (select.options[i].value === '{}' || select.options[i].text === '{}') {{
                    select.selectedIndex = i;
                    break;
                }}
            }}
        "#, option_value, option_value);

        self.client.execute_script(&script, vec![]).await?;
        debug!("Selected option '{}' from dropdown", option_value);
        Ok(())
    }

    /// Check a checkbox
    async fn execute_check(&self, step: &TestStep) -> Result<(), InteractionError> {
        if step.selectors.is_empty() {
            return Err(InteractionError::InvalidConfiguration(
                "Check step requires at least one selector".to_string()
            ));
        }

        let selector_fallback = SelectorFallback::new(self.client);
        let element = selector_fallback.find_element_with_fallback(&step.selectors).await?;

        // Check if already checked
        let is_checked = self.client.execute_script(
            "return arguments[0].checked;",
            vec![]
        ).await?;

        if !is_checked.as_bool().unwrap_or(false) {
            self.client.click_element(element).await?;
        }

        debug!("Checked checkbox");
        Ok(())
    }

    /// Uncheck a checkbox
    async fn execute_uncheck(&self, step: &TestStep) -> Result<(), InteractionError> {
        if step.selectors.is_empty() {
            return Err(InteractionError::InvalidConfiguration(
                "Uncheck step requires at least one selector".to_string()
            ));
        }

        let selector_fallback = SelectorFallback::new(self.client);
        let element = selector_fallback.find_element_with_fallback(&step.selectors).await?;

        // Check if checked
        let is_checked = self.client.execute_script(
            "return arguments[0].checked;",
            vec![]
        ).await?;

        if is_checked.as_bool().unwrap_or(false) {
            self.client.click_element(element).await?;
        }

        debug!("Unchecked checkbox");
        Ok(())
    }

    /// Upload a file
    async fn execute_upload(&self, step: &TestStep) -> Result<(), InteractionError> {
        if step.selectors.is_empty() {
            return Err(InteractionError::InvalidConfiguration(
                "Upload step requires at least one selector".to_string()
            ));
        }

        let file_path = step.value.as_ref()
            .ok_or_else(|| InteractionError::InvalidConfiguration(
                "Upload step requires a file path".to_string()
            ))?;

        let selector_fallback = SelectorFallback::new(self.client);
        let element = selector_fallback.find_element_with_fallback(&step.selectors).await?;

        // File upload is handled by sending the file path to the input element
        self.client.type_text(element, file_path).await?;
        debug!("Uploaded file: {}", file_path);
        Ok(())
    }

    /// Execute JavaScript
    async fn execute_script(&self, step: &TestStep) -> Result<(), InteractionError> {
        let script = step.value.as_ref()
            .ok_or_else(|| InteractionError::InvalidConfiguration(
                "Execute script step requires a JavaScript code".to_string()
            ))?;

        // Parse arguments from metadata
        let args: Vec<Value> = step.metadata.get("script_args")
            .and_then(|v| v.as_array())
            .map(|arr| arr.to_vec())
            .unwrap_or_default();

        self.client.execute_script(script, args).await?;
        debug!("Executed JavaScript script");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::selector::Selector;

    #[test]
    fn test_interaction_error_creation() {
        let error = InteractionError::UnsupportedAction("invalid".to_string());
        assert!(error.to_string().contains("Unsupported action"));
    }

    #[test]
    fn test_element_interaction_creation() {
        // This would require a WebDriver client instance
        // in actual tests
        let _client = WebDriverClient::new(
            crate::executor::webdriver_client::BrowserType::Chrome,
            true
        );
    }
}
