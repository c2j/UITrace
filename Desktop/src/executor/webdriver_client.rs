use crate::models::selector::Selector;
use crate::models::test_step::TestStep;
use thirtyfour::prelude::*;
use thirtyfour::{WebDriver, WebElement};
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
    WebDriver(#[from] WebDriverError),
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

        // Configure headless mode
        if headless {
            let mut chrome_opts = ChromeOptions::new();
            chrome_opts.add_arg("--headless");
            chrome_opts.add_arg("--no-sandbox");
            chrome_opts.add_arg("--disable-dev-shm-usage");
            caps = DesiredCapabilities::chrome().with_chrome_options(chrome_opts);
        }

        // Default timeout for operations
        let default_timeout = Duration::from_secs(30);

        // Connect to WebDriver
        let driver = WebDriver::new("http://localhost:4444", caps)
            .await
            .map_err(|e| WebDriverError::Initialization(e.to_string()))?;

        // Set page load timeout
        driver.set_page_load_timeout(default_timeout).await
            .map_err(|e| WebDriverError::Initialization(e.to_string()))?;

        // Set implicit wait for element finding
        driver.set_implicit_wait_timeout(Duration::from_secs(10)).await
            .map_err(|e| WebDriverError::Initialization(e.to_string()))?;

        info!("WebDriver initialized successfully for {:?}", browser);

        Ok(Self {
            driver,
            default_timeout,
        })
    }

    /// Navigate to a URL
    pub async fn navigate(&self, url: &str) -> Result<(), WebDriverError> {
        info!("Navigating to URL: {}", url);

        timeout(self.default_timeout, self.driver.goto(url))
            .await
            .map_err(|_| WebDriverError::NavigationFailed {
                url: url.to_string(),
                reason: "Timeout waiting for page load".to_string(),
            })?
            .map_err(|e| WebDriverError::NavigationFailed {
                url: url.to_string(),
                reason: e.to_string(),
            })?;

        debug!("Successfully navigated to: {}", url);
        Ok(())
    }

    /// Find an element by selector
    pub async fn find_element(&self, selector: &Selector) -> Result<WebElement, WebDriverError> {
        let element = match selector.selector_type.as_str() {
            "id" => {
                timeout(self.default_timeout, self.driver.find(By::Id(&selector.value)))
                    .await
                    .map_err(|_| WebDriverError::ElementTimeout {
                        selector: format!("id={}", selector.value),
                    })?
            }
            "css" => {
                timeout(self.default_timeout, self.driver.find(By::Css(&selector.value)))
                    .await
                    .map_err(|_| WebDriverError::ElementTimeout {
                        selector: format!("css={}", selector.value),
                    })?
            }
            "xpath" => {
                timeout(self.default_timeout, self.driver.find(By::XPath(&selector.value)))
                    .await
                    .map_err(|_| WebDriverError::ElementTimeout {
                        selector: format!("xpath={}", selector.value),
                    })?
            }
            "name" => {
                timeout(self.default_timeout, self.driver.find(By::Name(&selector.value)))
                    .await
                    .map_err(|_| WebDriverError::ElementTimeout {
                        selector: format!("name={}", selector.value),
                    })?
            }
            "class" => {
                timeout(self.default_timeout, self.driver.find(By::ClassName(&selector.value)))
                    .await
                    .map_err(|_| WebDriverError::ElementTimeout {
                        selector: format!("class={}", selector.value),
                    })?
            }
            "link_text" => {
                timeout(self.default_timeout, self.driver.find(By::LinkText(&selector.value)))
                    .await
                    .map_err(|_| WebDriverError::ElementTimeout {
                        selector: format!("link_text={}", selector.value),
                    })?
            }
            "partial_link_text" => {
                timeout(self.default_timeout, self.driver.find(By::PartialLinkText(&selector.value)))
                    .await
                    .map_err(|_| WebDriverError::ElementTimeout {
                        selector: format!("partial_link_text={}", selector.value),
                    })?
            }
            "tag" => {
                timeout(self.default_timeout, self.driver.find(By::Tag(&selector.value)))
                    .await
                    .map_err(|_| WebDriverError::ElementTimeout {
                        selector: format!("tag={}", selector.value),
                    })?
            }
            selector_type => {
                return Err(WebDriverError::ElementNotFound {
                    selector: format!("Unsupported selector type: {}", selector_type),
                });
            }
        };

        match element {
            Ok(el) => {
                debug!("Found element with selector: {:?}", selector);
                Ok(el)
            }
            Err(e) => {
                warn!("Element not found with selector {}: {}", selector.selector_type, e);
                Err(WebDriverError::ElementNotFound {
                    selector: format!("{}={}", selector.selector_type, selector.value),
                })
            }
        }
    }

    /// Wait for an element to be visible
    pub async fn wait_for_element(&self, selector: &Selector, wait_timeout: Option<Duration>) -> Result<WebElement, WebDriverError> {
        let wait_timeout = wait_timeout.unwrap_or(self.default_timeout);

        debug!("Waiting for element: {:?}", selector);

        let wait = self.driver.config().await?.with_wait_timeout(wait_timeout);

        match selector.selector_type.as_str() {
            "id" => {
                wait.until(async {
                    self.driver.find(By::Id(&selector.value)).await.ok()
                        .filter(|e| e.is_displayed().await.unwrap_or(false))
                }).await
            }
            "css" => {
                wait.until(async {
                    self.driver.find(By::Css(&selector.value)).await.ok()
                        .filter(|e| e.is_displayed().await.unwrap_or(false))
                }).await
            }
            "xpath" => {
                wait.until(async {
                    self.driver.find(By::XPath(&selector.value)).await.ok()
                        .filter(|e| e.is_displayed().await.unwrap_or(false))
                }).await
            }
            "name" => {
                wait.until(async {
                    self.driver.find(By::Name(&selector.value)).await.ok()
                        .filter(|e| e.is_displayed().await.unwrap_or(false))
                }).await
            }
            _ => {
                // Fallback to find_element for other selector types
                let element = self.find_element(selector).await?;
                if element.is_displayed().await.unwrap_or(false) {
                    return Ok(element);
                }
                return Err(WebDriverError::ElementTimeout {
                    selector: format!("{}={}", selector.selector_type, selector.value),
                });
            }
        }
        .map_err(|_| WebDriverError::ElementTimeout {
            selector: format!("{}={}", selector.selector_type, selector.value),
        })
    }

    /// Click on an element
    pub async fn click_element(&self, element: WebElement) -> Result<(), WebDriverError> {
        // Scroll element into view
        element.scroll_into_view().await
            .map_err(|e| WebDriverError::InteractionFailed {
                action: "scroll_into_view".to_string(),
                selector: "element".to_string(),
                reason: e.to_string(),
            })?;

        // Wait a moment for scrolling to complete
        tokio::time::sleep(Duration::from_millis(500)).await;

        // Click the element
        element.click().await
            .map_err(|e| WebDriverError::InteractionFailed {
                action: "click".to_string(),
                selector: "element".to_string(),
                reason: e.to_string(),
            })?;

        debug!("Successfully clicked element");
        Ok(())
    }

    /// Type text into an element
    pub async fn type_text(&self, element: WebElement, text: &str) -> Result<(), WebDriverError> {
        // Clear existing text if it's an input element
        let tag_name = element.tag_name().await
            .map_err(|e| WebDriverError::InteractionFailed {
                action: "get_tag_name".to_string(),
                selector: "element".to_string(),
                reason: e.to_string(),
            })?;

        if tag_name.to_lowercase() == "input" || tag_name.to_lowercase() == "textarea" {
            element.clear().await
                .map_err(|e| WebDriverError::InteractionFailed {
                    action: "clear".to_string(),
                    selector: "element".to_string(),
                    reason: e.to_string(),
                })?;
        }

        // Type the text
        element.send_keys(text).await
            .map_err(|e| WebDriverError::InteractionFailed {
                action: "type".to_string(),
                selector: "element".to_string(),
                reason: e.to_string(),
            })?;

        debug!("Successfully typed text into element");
        Ok(())
    }

    /// Take a screenshot
    pub async fn take_screenshot(&self) -> Result<Vec<u8>, WebDriverError> {
        let screenshot = self.driver.screenshot_as_png().await
            .map_err(|e| WebDriverError::ScriptExecution(e.to_string()))?;

        debug!("Screenshot captured successfully");
        Ok(screenshot)
    }

    /// Execute JavaScript
    pub async fn execute_script(&self, script: &str, args: Vec<serde_json::Value>) -> Result<serde_json::Value, WebDriverError> {
        let result = self.driver.execute(script, args).await
            .map_err(|e| WebDriverError::ScriptExecution(e.to_string()))?;

        debug!("Script executed successfully");
        Ok(result)
    }

    /// Get current URL
    pub async fn current_url(&self) -> Result<String, WebDriverError> {
        let url = self.driver.current_url().await
            .map_err(|e| WebDriverError::NavigationFailed {
                url: "unknown".to_string(),
                reason: e.to_string(),
            })?;
        Ok(url)
    }

    /// Get page title
    pub async fn page_title(&self) -> Result<String, WebDriverError> {
        let title = self.driver.title().await
            .map_err(|e| WebDriverError::ScriptExecution(e.to_string()))?;
        Ok(title)
    }

    /// Set timeout for page loads
    pub async fn set_page_load_timeout(&self, timeout: Duration) -> Result<(), WebDriverError> {
        self.driver.set_page_load_timeout(timeout).await
            .map_err(|e| WebDriverError::Initialization(e.to_string()))?;
        Ok(())
    }

    /// Get session ID
    pub async fn session_id(&self) -> Result<String, WebDriverError> {
        let session_id = self.driver.session_id().await
            .map_err(|e| WebDriverError::Initialization(e.to_string()))?;
        Ok(session_id)
    }

    /// Close the WebDriver session
    pub async fn quit(self) -> Result<(), WebDriverError> {
        self.driver.quit().await
            .map_err(|e| WebDriverError::Initialization(e.to_string()))?;
        info!("WebDriver session closed");
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub enum BrowserType {
    Chrome,
    Firefox,
    Edge,
}

impl std::fmt::Display for BrowserType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BrowserType::Chrome => write!(f, "Chrome"),
            BrowserType::Firefox => write!(f, "Firefox"),
            BrowserType::Edge => write!(f, "Edge"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::selector::Selector;

    #[tokio::test]
    #[ignore] // Requires running WebDriver server
    async fn test_webdriver_client_creation() {
        // This test requires a running WebDriver server
        // Run with: chromedriver --port=4444

        let client = WebDriverClient::new(BrowserType::Chrome, true).await;
        assert!(client.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_navigation() {
        let client = WebDriverClient::new(BrowserType::Chrome, true).await.unwrap();

        let result = client.navigate("https://example.com").await;
        assert!(result.is_ok());

        let url = client.current_url().await.unwrap();
        assert!(url.contains("example.com"));

        client.quit().await.unwrap();
    }

    #[test]
    fn test_browser_type_display() {
        assert_eq!(format!("{}", BrowserType::Chrome), "Chrome");
        assert_eq!(format!("{}", BrowserType::Firefox), "Firefox");
        assert_eq!(format!("{}", BrowserType::Edge), "Edge");
    }
}