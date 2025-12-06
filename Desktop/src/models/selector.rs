use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Selector {
    pub selector_type: String,
    pub value: String,
    pub priority: u32,
}

impl Selector {
    pub fn new(selector_type: String, value: String, priority: u32) -> Self {
        Self {
            selector_type,
            value,
            priority,
        }
    }

    pub fn id(value: String) -> Self {
        Self::new("id".to_string(), value, 1)
    }

    pub fn css(value: String) -> Self {
        Self::new("css".to_string(), value, 2)
    }

    pub fn xpath(value: String) -> Self {
        Self::new("xpath".to_string(), value, 3)
    }

    pub fn name(value: String) -> Self {
        Self::new("name".to_string(), value, 4)
    }

    pub fn class_name(value: String) -> Self {
        Self::new("class".to_string(), value, 5)
    }

    pub fn tag_name(value: String) -> Self {
        Self::new("tag".to_string(), value, 6)
    }

    pub fn link_text(value: String) -> Self {
        Self::new("link_text".to_string(), value, 7)
    }

    pub fn partial_link_text(value: String) -> Self {
        Self::new("partial_link_text".to_string(), value, 8)
    }

    pub fn is_high_priority(&self) -> bool {
        self.priority <= 3
    }

    pub fn to_webdriver_selector(&self) -> thirtyfour::By {
        use thirtyfour::By;

        match self.selector_type.as_str() {
            "id" => By::Id(&self.value),
            "css" => By::Css(&self.value),
            "xpath" => By::XPath(&self.value),
            "name" => By::Name(&self.value),
            "class" => By::ClassName(&self.value),
            "tag" => By::Tag(&self.value),
            "link_text" => By::LinkText(&self.value),
            "partial_link_text" => By::LinkText(&self.value), // thirtyfour doesn't have partial link text, use contains in xpath
            _ => By::Css(&self.value), // fallback to CSS
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_selector_creation() {
        let selector = Selector::id("submit-button".to_string());
        assert_eq!(selector.selector_type, "id");
        assert_eq!(selector.value, "submit-button");
        assert_eq!(selector.priority, 1);
    }

    #[test]
    fn test_selector_priority() {
        let high_priority = Selector::id("test".to_string());
        let low_priority = Selector::partial_link_text("test".to_string());

        assert!(high_priority.is_high_priority());
        assert!(!low_priority.is_high_priority());
    }
}