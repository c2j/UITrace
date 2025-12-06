use crate::models::Selector;
use crate::executor::webdriver_client::WebDriverClient;
use thirtyfour::WebElement;
use thiserror::Error;
use log::{debug, warn, info};

#[derive(Error, Debug)]
pub enum SelectorFallbackError {
    #[error("All selectors failed")]
    AllSelectorsFailed {
        attempted_selectors: Vec<String>,
        last_error: String,
    },
    #[error("WebDriver error: {0}")]
    WebDriver(#[from] crate::executor::webdriver_client::WebDriverError),
}

pub struct SelectorFallback<'a> {
    client: &'a WebDriverClient,
}

impl<'a> SelectorFallback<'a> {
    pub fn new(client: &'a WebDriverClient) -> Self {
        Self { client }
    }

    /// Find an element using multiple selectors with fallback strategy
    pub async fn find_element_with_fallback(
        &self,
        selectors: &[Selector],
    ) -> Result<WebElement, SelectorFallbackError> {
        let mut last_error = String::new();
        let mut attempted_selectors = Vec::new();

        // Sort selectors by priority
        let mut sorted_selectors = selectors.to_vec();
        sorted_selectors.sort_by_key(|s| s.priority);

        for (index, selector) in sorted_selectors.iter().enumerate() {
            let selector_str = format!("{}={}", selector.selector_type, selector.value);
            attempted_selectors.push(selector_str.clone());

            debug!(
                "Attempting selector {}/{}: {} (priority: {})",
                index + 1,
                sorted_selectors.len(),
                selector_str,
                selector.priority
            );

            match self.client.find_element(selector).await {
                Ok(element) => {
                    info!(
                        "Successfully found element with selector: {} (priority: {})",
                        selector_str,
                        selector.priority
                    );
                    return Ok(element);
                }
                Err(e) => {
                    warn!(
                        "Selector {} failed: {}",
                        selector_str,
                        e.to_string()
                    );
                    last_error = e.to_string();
                    continue;
                }
            }
        }

        Err(SelectorFallbackError::AllSelectorsFailed {
            attempted_selectors,
            last_error,
        })
    }

    /// Find element with fallback, but wait for element to be visible
    pub async fn find_visible_element_with_fallback(
        &self,
        selectors: &[Selector],
        wait_timeout: Option<std::time::Duration>,
    ) -> Result<WebElement, SelectorFallbackError> {
        let mut last_error = String::new();
        let mut attempted_selectors = Vec::new();

        // Sort selectors by priority
        let mut sorted_selectors = selectors.to_vec();
        sorted_selectors.sort_by_key(|s| s.priority);

        for (index, selector) in sorted_selectors.iter().enumerate() {
            let selector_str = format!("{}={}", selector.selector_type, selector.value);
            attempted_selectors.push(selector_str.clone());

            debug!(
                "Waiting for visible element {}/{}: {} (priority: {})",
                index + 1,
                sorted_selectors.len(),
                selector_str,
                selector.priority
            );

            match self.client.wait_for_element(selector, wait_timeout).await {
                Ok(element) => {
                    info!(
                        "Successfully found visible element with selector: {} (priority: {})",
                        selector_str,
                        selector.priority
                    );
                    return Ok(element);
                }
                Err(e) => {
                    warn!(
                        "Visible element selector {} failed: {}",
                        selector_str,
                        e.to_string()
                    );
                    last_error = e.to_string();
                    continue;
                }
            }
        }

        Err(SelectorFallbackError::AllSelectorsFailed {
            attempted_selectors,
            last_error,
        })
    }

    /// Get detailed information about why selectors failed
    pub fn get_failure_info(&self, selectors: &[Selector]) -> SelectorFailureInfo {
        let mut info = SelectorFailureInfo {
            total_selectors: selectors.len(),
            prioritized_selectors: Vec::new(),
            recommended_actions: Vec::new(),
        };

        // Analyze selectors
        let mut sorted_selectors = selectors.to_vec();
        sorted_selectors.sort_by_key(|s| s.priority);

        for selector in &sorted_selectors {
            info.prioritized_selectors.push(format!(
                "{} (priority: {}, type: {})",
                selector.value,
                selector.priority,
                selector.selector_type
            ));
        }

        // Add recommendations based on selector types
        let has_id = selectors.iter().any(|s| s.selector_type == "id");
        let has_css = selectors.iter().any(|s| s.selector_type == "css");
        let has_xpath = selectors.iter().any(|s| s.selector_type == "xpath");

        if !has_id {
            info.recommended_actions.push(
                "Consider adding an ID selector if the element has a unique ID".to_string()
            );
        }

        if has_xpath && !has_css {
            info.recommended_actions.push(
                "Consider adding CSS selectors as they are generally faster than XPath".to_string()
            );
        }

        if selectors.is_empty() {
            info.recommended_actions.push(
                "No selectors provided - add at least one selector strategy".to_string()
            );
        }

        info
    }
}

#[derive(Debug)]
pub struct SelectorFailureInfo {
    pub total_selectors: usize,
    pub prioritized_selectors: Vec<String>,
    pub recommended_actions: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::selector::Selector;

    #[test]
    fn test_selector_failure_info() {
        let selectors = vec![
            Selector::new("xpath".to_string(), "//div[@class='test']".to_string(), 3),
            Selector::new("id".to_string(), "test-id".to_string(), 1),
            Selector::new("css".to_string(), ".test-class".to_string(), 2),
        ];

        let fallback = SelectorFallback {
            client: &WebDriverClient::new(crate::executor::webdriver_client::BrowserType::Chrome, true)
                .await.unwrap(),
        };

        let info = fallback.get_failure_info(&selectors);

        assert_eq!(info.total_selectors, 3);
        assert_eq!(info.prioritized_selectors.len(), 3);
        assert_eq!(info.prioritized_selectors[0], "test-id (priority: 1, type: id)");
        assert_eq!(info.prioritized_selectors[1], ".test-class (priority: 2, type: css)");
        assert_eq!(info.prioritized_selectors[2], "//div[@class='test'] (priority: 3, type: xpath)");
    }

    #[test]
    fn test_selector_prioritization() {
        let mut selectors = vec![
            Selector::new("xpath".to_string(), "//button".to_string(), 5),
            Selector::new("css".to_string(), "button.submit".to_string(), 2),
            Selector::new("id".to_string(), "submit-btn".to_string(), 1),
            Selector::new("tag".to_string(), "button".to_string(), 6),
        ];

        // Sort by priority
        selectors.sort_by_key(|s| s.priority);

        assert_eq!(selectors[0].selector_type, "id");
        assert_eq!(selectors[1].selector_type, "css");
        assert_eq!(selectors[2].selector_type, "xpath");
        assert_eq!(selectors[3].selector_type, "tag");
    }
}