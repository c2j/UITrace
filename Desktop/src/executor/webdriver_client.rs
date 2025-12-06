use crate::models::selector::Selector;
use crate::models::test_step::TestStep;
use thirtyfour::prelude::*;
use std::time::Duration;
use thiserror::Error;
use tokio::time::timeout;
use log::{debug, warn, error, info};

#[derive(Error, Debug)]
pub enum WebDriverError {
    #[error("WebDriver initialization error: {0}")]
    Initialization(String),
    #[error("Element not found: {selector}")]
    ElementNotFound { selector: String },
    #[error("Timeout waiting for element: {selector}")]
    ElementTimeout { selector: String },
    #[error("Element interaction failed: {action} on {selector} - {reason}")]
    InteractionFailed { action: String, selector: String, reason: String },
    #[error("Navigation failed: {url} - {reason}")]
    NavigationFailed { url: String, reason: String },
    #[error("Script execution failed: {0}")]
    ScriptExecution(String),
    #[error("WebDriver error: {0}")]
    WebDriverError(String),
}

#[derive(Debug, Clone)]
pub enum BrowserType {
    Chrome,
    Firefox,
    Edge,
}

pub struct WebDriverClient {
    driver: WebDriver,
    default_timeout: Duration,
}

impl WebDriverClient {
    /// Create a new WebDriver client
    pub async fn new(browser: BrowserType, headless: bool) -> Result<Self, WebDriverError> {
        let mut caps = match browser {
            BrowserType::Chrome => DesiredCapabilities::chrome(),
            BrowserType::Firefox => DesiredCapabilities::firefox(),
            BrowserType::Edge => DesiredCapabilities::edge(),
        };

        // Configure headless mode for Chrome
        if headless && matches!(browser, BrowserType::Chrome) {
            let chrome_opts = vec![
                "--headless",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ];

            for opt in chrome_opts {
                caps = caps.add_chrome_option(opt.to_string(), serde_json::Value::Bool(true))
                    .map_err(|e| WebDriverError::Initialization(format!("Failed to add Chrome option: {}", e)))?;
            }
        }

        // Configure timeout
        let timeout = Duration::from_secs(30);

        // Connect to WebDriver
        let driver = WebDriver::new("http://localhost:4444", caps)
            .await
            .map_err(|e| WebDriverError::WebDriverError(format!("Failed to connect to WebDriver: {}", e)))?;

        Ok(Self {
            driver,
            default_timeout: timeout,
        })
    }

    /// Navigate to a URL
    pub async fn navigate_to(&self, url: &str) -> Result<(), WebDriverError> {
        info!("Navigating to: {}", url);

        self.driver.goto(url)
            .await
            .map_err(|e| WebDriverError::NavigationFailed {
                url: url.to_string(),
                reason: format!("Failed to navigate: {}", e),
            })?;

        // Wait for page to load
        tokio::time::sleep(Duration::from_millis(500)).await;

        Ok(())
    }

    /// Find an element using multiple selectors
    pub async fn find_element(&self, selectors: &[Selector]) -> Result<WebElement, WebDriverError> {
        for selector in selectors {
            debug!("Trying selector: {}", selector.value);

            let result = match selector.selector_type.as_str() {
                "id" => self.driver.find(By::Id(&selector.value)).await,
                "css" => self.driver.find(By::Css(&selector.value)).await,
                "xpath" => self.driver.find(By::XPath(&selector.value)).await,
                "name" => self.driver.find(By::Name(&selector.value)).await,
                "class" => self.driver.find(By::ClassName(&selector.value)).await,
                "link_text" => self.driver.find(By::LinkText(&selector.value)).await,
                _ => {
                    warn!("Unsupported selector type: {}", selector.selector_type);
                    continue;
                }
            };

            match result {
                Ok(element) => {
                    debug!("Found element using selector: {}", selector.value);
                    return Ok(element);
                }
                Err(_) => {
                    debug!("Failed to find element with selector: {}", selector.value);
                    continue;
                }
            }
        }

        Err(WebDriverError::ElementNotFound {
            selector: format!("None of {} selectors matched", selectors.len()),
        })
    }

    /// Click on an element
    pub async fn click(&self, step: &TestStep) -> Result<(), WebDriverError> {
        let element = self.find_element(&step.selectors).await?;

        element.click()
            .await
            .map_err(|e| WebDriverError::InteractionFailed {
                action: "click".to_string(),
                selector: step.selectors[0].value.clone(),
                reason: format!("Failed to click element: {}", e),
            })?;

        Ok(())
    }

    /// Type text into an element
    pub async fn type_text(&self, step: &TestStep, text: &str) -> Result<(), WebDriverError> {
        let element = self.find_element(&step.selectors).await?;

        element.clear()
            .await
            .map_err(|e| WebDriverError::InteractionFailed {
                action: "clear".to_string(),
                selector: step.selectors[0].value.clone(),
                reason: format!("Failed to clear element: {}", e),
            })?;

        element.send_keys(text)
            .await
            .map_err(|e| WebDriverError::InteractionFailed {
                action: "type".to_string(),
                selector: step.selectors[0].value.clone(),
                reason: format!("Failed to type text: {}", e),
            })?;

        Ok(())
    }

    /// Get current URL
    pub async fn get_current_url(&self) -> Result<String, WebDriverError> {
        self.driver.current_url()
            .await
            .map(|url| url.to_string())
            .map_err(|e| WebDriverError::WebDriverError(format!("Failed to get current URL: {}", e)))
    }

    /// Take a screenshot
    pub async fn take_screenshot(&self, path: &str) -> Result<(), WebDriverError> {
        self.driver.screenshot(path)
            .await
            .map_err(|e| WebDriverError::WebDriverError(format!("Failed to take screenshot: {}", e)))
    }

    /// Execute JavaScript
    pub async fn execute_script(&self, script: &str, args: Vec<serde_json::Value>) -> Result<serde_json::Value, WebDriverError> {
        self.driver.execute(script, args)
            .await
            .map_err(|e| WebDriverError::ScriptExecution(format!("Script execution failed: {}", e)))
    }

    /// Close the WebDriver
    pub async fn close(self) -> Result<(), WebDriverError> {
        self.driver.quit()
            .await
            .map_err(|e| WebDriverError::WebDriverError(format!("Failed to close WebDriver: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_browser_type_creation() {
        let chrome = BrowserType::Chrome;
        let firefox = BrowserType::Firefox;
        let edge = BrowserType::Edge;

        // Just ensure the enum variants exist
        match chrome {
            BrowserType::Chrome => {}
        }
        match firefox {
            BrowserType::Firefox => {}
        }
        match edge {
            BrowserType::Edge => {}
        }
    }
}