use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotConfig {
    /// Time to wait after page load before taking screenshot (ms)
    pub wait_time: u64,
    /// Browser window size (width, height)
    pub window_size: Option<(u32, u32)>,
    /// Whether to hide scrollbars
    pub hide_scrollbars: bool,
    /// Whether to capture full page (including scrollable area)
    pub full_page: bool,
    /// CSS selector for element to screenshot (optional)
    pub element_selector: Option<String>,
    /// Image quality for JPEG screenshots (0-100)
    pub quality: Option<u8>,
}

impl Default for ScreenshotConfig {
    fn default() -> Self {
        Self {
            wait_time: 1000,
            window_size: None,
            hide_scrollbars: false,
            full_page: false,
            element_selector: None,
            quality: None,
        }
    }
}