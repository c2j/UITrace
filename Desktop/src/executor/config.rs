use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionConfig {
    /// Maximum number of retries for failed steps
    pub max_retries: u32,
    /// Delay between retries in milliseconds
    pub retry_delay: u64,
    /// Timeout for step execution in milliseconds
    pub step_timeout: u64,
    /// Whether to stop execution on first failure
    pub stop_on_failure: bool,
    /// Whether to take screenshots on failure
    pub screenshot_on_failure: bool,
    /// Whether to take screenshots after each step
    pub screenshot_after_step: bool,
    /// Browser configuration
    pub browser: BrowserConfig,
    /// Parallel execution settings
    pub parallel: ParallelConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserConfig {
    pub browser_type: BrowserType,
    pub headless: bool,
    pub window_size: Option<(u32, u32)>,
    pub user_agent: Option<String>,
    pub proxy: Option<ProxyConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BrowserType {
    Chrome,
    Firefox,
    Safari,
    Edge,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelConfig {
    /// Number of parallel threads
    pub threads: u32,
    /// Whether to use data-driven parallelism
    pub data_driven: bool,
}

impl Default for ExecutionConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            retry_delay: 1000,
            step_timeout: 30000,
            stop_on_failure: true,
            screenshot_on_failure: true,
            screenshot_after_step: false,
            browser: BrowserConfig {
                browser_type: BrowserType::Chrome,
                headless: false,
                window_size: Some((1920, 1080)),
                user_agent: None,
                proxy: None,
            },
            parallel: ParallelConfig {
                threads: 1,
                data_driven: false,
            },
        }
    }
}