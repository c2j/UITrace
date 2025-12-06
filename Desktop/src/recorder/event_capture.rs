use crate::models::test_step::TestStep;
use crate::models::selector::Selector;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EventCaptureError {
    #[error("Invalid element tag: {0}")]
    InvalidTag(String),
    #[error("Missing required field: {0}")]
    MissingField(String),
    #[error("Empty value for type action")]
    EmptyTypeValue,
}

#[derive(Debug, Clone)]
pub enum DomEvent {
    Click {
        element_id: Option<String>,
        element_tag: String,
        element_text: Option<String>,
        coordinates: (u32, u32),
    },
    Type {
        element_id: Option<String>,
        element_tag: String,
        input_type: Option<String>,
        value: String,
    },
    Navigation {
        url: String,
        previous_url: String,
    },
    Scroll {
        x: u32,
        y: u32,
        delta_x: i32,
        delta_y: i32,
    },
}

pub struct EventCapture;

impl EventCapture {
    pub fn capture_event(event: DomEvent) -> Result<TestStep, EventCaptureError> {
        match event {
            DomEvent::Click {
                element_id,
                element_tag,
                element_text,
                coordinates
            } => {
                Self::capture_click_event(element_id, element_tag, element_text, coordinates)
            },
            DomEvent::Type {
                element_id,
                element_tag,
                input_type: _,
                value
            } => {
                Self::capture_type_event(element_id, element_tag, value)
            },
            DomEvent::Navigation { url, previous_url: _ } => {
                Self::capture_navigation_event(url)
            },
            DomEvent::Scroll { x, y, delta_x, delta_y } => {
                Self::capture_scroll_event(x, y, delta_x, delta_y)
            },
        }
    }

    fn capture_click_event(
        element_id: Option<String>,
        element_tag: String,
        element_text: Option<String>,
        coordinates: (u32, u32),
    ) -> Result<TestStep, EventCaptureError> {
        if element_tag.is_empty() {
            return Err(EventCaptureError::InvalidTag(element_tag));
        }

        let mut step = TestStep::new(
            1, // This will be set by the recorder
            format!("Click on {}", element_tag),
            "click".to_string(),
        );

        // Generate selectors
        let selectors = Self::generate_selectors(&element_id, &element_tag, None, element_text.as_deref());
        step.selectors = selectors;

        // Add metadata
        step.metadata.insert("element_tag".to_string(), element_tag.clone());
        if let Some(text) = &element_text {
            step.metadata.insert("element_text".to_string(), text.clone());
        }
        step.metadata.insert("coordinates".to_string(), format!("{:?}", coordinates));

        Ok(step)
    }

    fn capture_type_event(
        element_id: Option<String>,
        element_tag: String,
        value: String,
    ) -> Result<TestStep, EventCaptureError> {
        if element_tag.is_empty() {
            return Err(EventCaptureError::InvalidTag(element_tag));
        }

        if value.is_empty() {
            return Err(EventCaptureError::EmptyTypeValue);
        }

        let mut step = TestStep::new(
            1, // This will be set by the recorder
            format!("Type in {}", element_tag),
            "type".to_string(),
        );

        step.value = Some(value.clone());

        // Generate selectors
        let selectors = Self::generate_selectors(&element_id, &element_tag, None, None);
        step.selectors = selectors;

        // Add metadata
        step.metadata.insert("element_tag".to_string(), element_tag.clone());

        Ok(step)
    }

    fn capture_navigation_event(url: String) -> Result<TestStep, EventCaptureError> {
        if url.is_empty() {
            return Err(EventCaptureError::MissingField("url".to_string()));
        }

        let mut step = TestStep::new(
            1, // This will be set by the recorder
            format!("Navigate to {}", url),
            "navigate".to_string(),
        );

        step.value = Some(url.clone());

        // Navigation doesn't need selectors
        step.metadata.insert("url".to_string(), url);

        Ok(step)
    }

    fn capture_scroll_event(
        x: u32,
        y: u32,
        delta_x: i32,
        delta_y: i32,
    ) -> Result<TestStep, EventCaptureError> {
        let step = TestStep::new(
            1, // This will be set by the recorder
            format!("Scroll to ({}, {})", x, y),
            "scroll".to_string(),
        );

        // Add metadata for scroll position and delta
        let mut metadata = std::collections::HashMap::new();
        metadata.insert("scroll_x".to_string(), x.to_string());
        metadata.insert("scroll_y".to_string(), y.to_string());
        metadata.insert("delta_x".to_string(), delta_x.to_string());
        metadata.insert("delta_y".to_string(), delta_y.to_string());

        Ok(step)
    }

    fn generate_selectors(
        element_id: &Option<String>,
        element_tag: &str,
        element_name: Option<&str>,
        element_text: Option<&str>,
    ) -> Vec<Selector> {
        let mut selectors = Vec::new();
        let mut priority = 1u32;

        // ID selector (highest priority)
        if let Some(id) = element_id {
            if !id.is_empty() {
                selectors.push(Selector::new("id".to_string(), id.clone(), priority));
                priority += 1;
            }
        }

        // CSS selector based on tag and attributes
        let mut css_selector = element_tag.to_string();

        // Add ID to CSS selector if available
        if let Some(id) = element_id {
            if !id.is_empty() {
                css_selector = format!("{}#{}", css_selector, id);
            }
        }

        // Add name attribute if available
        if let Some(name) = element_name {
            if !name.is_empty() {
                css_selector = format!("{}[name='{}']", css_selector, name);
            }
        }

        selectors.push(Selector::new("css".to_string(), css_selector.clone(), priority));
        priority += 1;

        // XPath selector
        let mut xpath = format!("//{}", element_tag);

        if let Some(id) = element_id {
            if !id.is_empty() {
                xpath = format!("{}[@id='{}']", xpath, id);
            }
        }

        selectors.push(Selector::new("xpath".to_string(), xpath, priority));
        priority += 1;

        // Text-based selectors if text is available
        if let Some(text) = element_text {
            if !text.is_empty() {
                // Link text selector
                if element_tag == "a" {
                    selectors.push(Selector::new("link_text".to_string(), text.to_string(), priority));
                    priority += 1;

                    selectors.push(Selector::new("partial_link_text".to_string(), text.to_string(), priority));
                    priority += 1;
                }
            }
        }

        // Tag selector (lowest priority)
        selectors.push(Selector::new("tag".to_string(), element_tag.to_string(), priority));

        selectors
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_selectors_with_id() {
        let selectors = EventCapture::generate_selectors(
            &Some("submit-button".to_string()),
            "button",
            None,
            None,
        );

        assert!(selectors.iter().any(|s| s.selector_type == "id" && s.value == "submit-button"));
        assert!(selectors.iter().any(|s| s.selector_type == "css"));
        assert!(selectors.iter().any(|s| s.selector_type == "xpath"));
        assert!(selectors.iter().any(|s| s.selector_type == "tag"));
    }

    #[test]
    fn test_generate_selectors_without_id() {
        let selectors = EventCapture::generate_selectors(
            &None,
            "div",
            None,
            None,
        );

        assert!(!selectors.iter().any(|s| s.selector_type == "id"));
        assert!(selectors.iter().any(|s| s.selector_type == "css"));
        assert!(selectors.iter().any(|s| s.selector_type == "xpath"));
    }

    #[test]
    fn test_capture_click_event() {
        let result = EventCapture::capture_event(DomEvent::Click {
            element_id: Some("test-id".to_string()),
            element_tag: "button".to_string(),
            element_text: Some("Click Me".to_string()),
            coordinates: (100, 200),
        });

        assert!(result.is_ok());
        let step = result.unwrap();
        assert_eq!(step.action, "click");
        assert!(step.selectors.len() >= 3);
    }

    #[test]
    fn test_capture_type_event() {
        let result = EventCapture::capture_event(DomEvent::Type {
            element_id: Some("username".to_string()),
            element_tag: "input".to_string(),
            input_type: Some("text".to_string()),
            value: "testuser".to_string(),
        });

        assert!(result.is_ok());
        let step = result.unwrap();
        assert_eq!(step.action, "type");
        assert_eq!(step.value, Some("testuser".to_string()));
    }

    #[test]
    fn test_invalid_tag_error() {
        let result = EventCapture::capture_event(DomEvent::Click {
            element_id: None,
            element_tag: "".to_string(),
            element_text: None,
            coordinates: (0, 0),
        });

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), EventCaptureError::InvalidTag(_)));
    }

    #[test]
    fn test_empty_type_value_error() {
        let result = EventCapture::capture_event(DomEvent::Type {
            element_id: Some("test".to_string()),
            element_tag: "input".to_string(),
            input_type: None,
            value: "".to_string(),
        });

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), EventCaptureError::EmptyTypeValue));
    }
}

// Types are already defined in this module