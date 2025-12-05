use tracing::{info, debug, error};
use std::collections::HashMap;

pub struct EventRecorder {
    is_recording: bool,
    recorded_events: Vec<RecordedEvent>,
}

#[derive(Debug, Clone)]
pub struct RecordedEvent {
    pub event_type: String,
    pub selector: String,
    pub value: Option<String>,
    pub timestamp: u64,
    pub coordinates: Option<(i32, i32)>,
}

impl EventRecorder {
    pub fn new() -> Self {
        Self {
            is_recording: false,
            recorded_events: Vec::new(),
        }
    }

    pub fn start_recording(&mut self) {
        info!("Starting event recording");
        self.is_recording = true;
        self.recorded_events.clear();
    }

    pub fn stop_recording(&mut self) {
        info!("Stopping event recording");
        self.is_recording = false;
    }

    pub fn record_event(&mut self, event: RecordedEvent) {
        if !self.is_recording {
            debug!("Event received but not recording: {:?}", event);
            return;
        }

        debug!("Recording event: {:?}", event);
        self.recorded_events.push(event);
    }

    pub fn get_recorded_events(&self) -> &Vec<RecordedEvent> {
        &self.recorded_events
    }

    pub fn clear_events(&mut self) {
        self.recorded_events.clear();
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording
    }
}

impl Default for EventRecorder {
    fn default() -> Self {
        Self::new()
    }
}

pub fn generate_selector(element: &str) -> Vec<String> {
    let mut selectors = Vec::new();

    // Priority order for selector generation
    // 1. Try data attributes first (most reliable)
    if element.contains("data-testid=") {
        if let Some(testid) = extract_attribute(element, "data-testid") {
            selectors.push(format!("[data-testid=\"{}\"]", testid));
        }
    }

    if element.contains("data-cy=") {
        if let Some(cy) = extract_attribute(element, "data-cy") {
            selectors.push(format!("[data-cy=\"{}\"]", cy));
        }
    }

    // 2. Try ID selector
    if element.contains("id=") {
        if let Some(id) = extract_attribute(element, "id") {
            selectors.push(format!("#{}", id));
        }
    }

    // 3. Try name attribute
    if element.contains("name=") {
        if let Some(name) = extract_attribute(element, "name") {
            selectors.push(format!("[name=\"{}\"]", name));
        }
    }

    // 4. Generate CSS selector from element structure
    if let Some(css_selector) = generate_css_selector(element) {
        selectors.push(css_selector);
    }

    // 5. Generate XPath as fallback
    if let Some(xpath) = generate_xpath_selector(element) {
        selectors.push(xpath);
    }

    selectors
}

fn extract_attribute(element: &str, attr: &str) -> Option<String> {
    let pattern = format!(r#"{}="([^"]*)""#, attr);
    // Simple regex-like parsing (in real implementation, use proper regex)
    if let Some(start) = element.find(&format!("{}=\"", attr)) {
        let start_idx = start + attr.len() + 2;
        if let Some(end_idx) = element[start_idx..].find('"') {
            return Some(element[start_idx..start_idx + end_idx].to_string());
        }
    }
    None
}

fn generate_css_selector(element: &str) -> Option<String> {
    // Simplified CSS selector generation
    // In real implementation, parse HTML structure properly
    if element.contains("button") {
        Some("button".to_string())
    } else if element.contains("input") {
        Some("input".to_string())
    } else if element.contains("a") {
        Some("a".to_string())
    } else {
        None
    }
}

fn generate_xpath_selector(element: &str) -> Option<String> {
    // Simplified XPath generation
    if element.contains("button") {
        Some("//button".to_string())
    } else if element.contains("input") {
        Some("//input".to_string())
    } else {
        None
    }
}