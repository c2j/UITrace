use crate::models::Selector;
use std::collections::HashMap;

pub struct SelectorGenerator;

impl SelectorGenerator {
    pub fn generate_selectors(element_info: &ElementInfo) -> Vec<Selector> {
        let mut selectors = Vec::new();
        let mut priority = 1u32;

        // ID selector (highest priority)
        if let Some(id) = &element_info.id {
            if Self::is_valid_id(id) {
                selectors.push(Selector::new("id".to_string(), id.clone(), priority));
                priority += 1;
            }
        }

        // Name selector
        if let Some(name) = &element_info.name {
            if Self::is_valid_name(name) {
                selectors.push(Selector::new("name".to_string(), name.clone(), priority));
                priority += 1;
            }
        }

        // CSS selector based on class
        if let Some(class) = &element_info.class_name {
            if Self::is_valid_class(class) {
                selectors.push(Selector::new("css".to_string(), format!("{}.{}", element_info.tag_name, class), priority));
                priority += 1;

                // Generic class selector
                selectors.push(Selector::new("css".to_string(), format!(".{}", class), priority));
                priority += 1;
            }
        }

        // CSS selector based on tag and attributes
        let css_selector = Self::build_css_selector(element_info);
        if !css_selector.is_empty() && css_selector != element_info.tag_name {
            selectors.push(Selector::new("css".to_string(), css_selector, priority));
            priority += 1;
        }

        // XPath selectors
        let xpath_selectors = Self::generate_xpath_selectors(element_info);
        for xpath in xpath_selectors {
            selectors.push(Selector::new("xpath".to_string(), xpath, priority));
            priority += 1;
        }

        // Link text selectors
        if element_info.tag_name == "a" {
            if let Some(text) = &element_info.text_content {
                if !text.trim().is_empty() {
                    selectors.push(Selector::new("link_text".to_string(), text.clone(), priority));
                    priority += 1;

                    selectors.push(Selector::new("partial_link_text".to_string(), text.clone(), priority));
                    priority += 1;
                }
            }
        }

        // Tag selector (lowest priority)
        selectors.push(Selector::new("tag".to_string(), element_info.tag_name.clone(), priority));

        // Sort by priority
        selectors.sort_by_key(|s| s.priority);

        selectors
    }

    fn build_css_selector(element_info: &ElementInfo) -> String {
        let mut selector = element_info.tag_name.clone();

        // Add ID
        if let Some(id) = &element_info.id {
            if Self::is_valid_id(id) {
                selector = format!("{}#{}", selector, id);
            }
        }

        // Add classes
        if let Some(class) = &element_info.class_name {
            if Self::is_valid_class(class) {
                let classes: Vec<&str> = class.split_whitespace().collect();
                for class_name in classes {
                    selector = format!("{}.{}", selector, class_name);
                }
            }
        }

        // Add other attributes
        let mut attributes = Vec::new();

        if let Some(name) = &element_info.name {
            if Self::is_valid_name(name) {
                attributes.push(format!("[name='{}']", name));
            }
        }

        if let Some(placeholder) = &element_info.placeholder {
            if !placeholder.is_empty() {
                attributes.push(format!("[placeholder='{}']", placeholder));
            }
        }

        if let Some(alt) = &element_info.alt_text {
            if !alt.is_empty() {
                attributes.push(format!("[alt='{}']", alt));
            }
        }

        format!("{}{}", selector, attributes.join(""))
    }

    fn generate_xpath_selectors(element_info: &ElementInfo) -> Vec<String> {
        let mut xpaths = Vec::new();

        // Absolute XPath with ID
        if let Some(id) = &element_info.id {
            if Self::is_valid_id(id) {
                xpaths.push(format!("//{}[@id='{}']", element_info.tag_name, id));
            }
        }

        // XPath with attributes
        let mut conditions = Vec::new();

        if let Some(name) = &element_info.name {
            if Self::is_valid_name(name) {
                conditions.push(format!("@name='{}'", name));
            }
        }

        if let Some(class) = &element_info.class_name {
            if Self::is_valid_class(class) {
                conditions.push(format!("contains(@class, '{}')", class));
            }
        }

        if let Some(text) = &element_info.text_content {
            if !text.trim().is_empty() && element_info.tag_name != "a" {
                conditions.push(format!("text()='{}'", text.trim()));
            }
        }

        if !conditions.is_empty() {
            xpaths.push(format!("//{}[{}]", element_info.tag_name, conditions.join(" and ")));
        }

        // Position-based XPath
        if let Some(index) = element_info.element_index {
            xpaths.push(format!("//{}[{}]", element_info.tag_name, index + 1));
        }

        xpaths
    }

    fn is_valid_id(id: &str) -> bool {
        !id.is_empty() &&
        !id.contains(' ') &&
        !id.starts_with('0') &&
        id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    }

    fn is_valid_name(name: &str) -> bool {
        !name.is_empty() &&
        !name.contains('"') &&
        !name.contains('\'') &&
        name.len() < 100
    }

    fn is_valid_class(class: &str) -> bool {
        !class.is_empty() &&
        !class.contains('"') &&
        !class.contains('\'') &&
        class.len() < 200
    }

    pub fn optimize_selectors(selectors: &mut Vec<Selector>) {
        // Remove duplicates
        let mut seen = std::collections::HashSet::new();
        selectors.retain(|s| seen.insert((s.selector_type.clone(), s.value.clone())));

        // Sort by priority
        selectors.sort_by_key(|s| s.priority);

        // Limit to reasonable number
        if selectors.len() > 5 {
            selectors.truncate(5);
        }
    }

    pub fn score_selector(selector: &Selector, element_info: &ElementInfo) -> u32 {
        let mut score = 100 - selector.priority * 10; // Base score from priority

        // Bonus for ID selectors
        if selector.selector_type == "id" && Self::is_valid_id(&selector.value) {
            score += 50;
        }

        // Bonus for unique selectors
        if selector.selector_type == "css" && selector.value.contains('#') {
            score += 30;
        }

        // Penalty for overly generic selectors
        if selector.selector_type == "tag" && selector.value == "div" {
            score -= 20;
        }

        // Bonus for text-based selectors on interactive elements
        if selector.selector_type == "link_text" && element_info.tag_name == "a" {
            score += 25;
        }

        score
    }
}

#[derive(Debug, Clone)]
pub struct ElementInfo {
    pub tag_name: String,
    pub id: Option<String>,
    pub name: Option<String>,
    pub class_name: Option<String>,
    pub text_content: Option<String>,
    pub placeholder: Option<String>,
    pub alt_text: Option<String>,
    pub title: Option<String>,
    pub element_index: Option<usize>,
    pub attributes: HashMap<String, String>,
}

impl ElementInfo {
    pub fn new(tag_name: String) -> Self {
        Self {
            tag_name,
            id: None,
            name: None,
            class_name: None,
            text_content: None,
            placeholder: None,
            alt_text: None,
            title: None,
            element_index: None,
            attributes: HashMap::new(),
        }
    }

    pub fn with_id(mut self, id: String) -> Self {
        self.id = Some(id);
        self
    }

    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    pub fn with_class(mut self, class: String) -> Self {
        self.class_name = Some(class);
        self
    }

    pub fn with_text(mut self, text: String) -> Self {
        self.text_content = Some(text);
        self
    }

    pub fn with_placeholder(mut self, placeholder: String) -> Self {
        self.placeholder = Some(placeholder);
        self
    }

    pub fn with_index(mut self, index: usize) -> Self {
        self.element_index = Some(index);
        self
    }

    pub fn add_attribute(mut self, key: String, value: String) -> Self {
        self.attributes.insert(key, value);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_selectors_with_id() {
        let element = ElementInfo::new("button".to_string())
            .with_id("submit-btn".to_string())
            .with_text("Submit".to_string());

        let selectors = SelectorGenerator::generate_selectors(&element);

        // Should have ID selector
        assert!(selectors.iter().any(|s| s.selector_type == "id" && s.value == "submit-btn"));

        // Should have CSS selector
        assert!(selectors.iter().any(|s| s.selector_type == "css" && s.value.contains("button")));

        // Should have XPath selector
        assert!(selectors.iter().any(|s| s.selector_type == "xpath"));
    }

    #[test]
    fn test_generate_selectors_with_class() {
        let element = ElementInfo::new("div".to_string())
            .with_class("form-group container".to_string());

        let selectors = SelectorGenerator::generate_selectors(&element);

        // Should have class-based CSS selectors
        assert!(selectors.iter().any(|s| s.selector_type == "css" && s.value.contains(".form-group")));
        assert!(selectors.iter().any(|s| s.selector_type == "css" && s.value.contains(".container")));
    }

    #[test]
    fn test_generate_selectors_link() {
        let element = ElementInfo::new("a".to_string())
            .with_text("Click here".to_string());

        let selectors = SelectorGenerator::generate_selectors(&element);

        // Should have link text selectors
        assert!(selectors.iter().any(|s| s.selector_type == "link_text" && s.value == "Click here"));
        assert!(selectors.iter().any(|s| s.selector_type == "partial_link_text" && s.value == "Click here"));
    }

    #[test]
    fn test_selector_optimization() {
        let mut selectors = vec![
            Selector::new("css".to_string(), "button".to_string(), 1),
            Selector::new("css".to_string(), "button".to_string(), 2), // Duplicate
            Selector::new("id".to_string(), "btn1".to_string(), 3),
            Selector::new("id".to_string(), "btn1".to_string(), 4), // Duplicate
        ];

        SelectorGenerator::optimize_selectors(&mut selectors);

        // Should remove duplicates
        assert_eq!(selectors.len(), 2);
        assert!(selectors.iter().any(|s| s.selector_type == "css" && s.value == "button"));
        assert!(selectors.iter().any(|s| s.selector_type == "id" && s.value == "btn1"));
    }

    #[test]
    fn test_selector_scoring() {
        let element = ElementInfo::new("button".to_string())
            .with_id("unique-btn".to_string());

        let id_selector = Selector::new("id".to_string(), "unique-btn".to_string(), 1);
        let tag_selector = Selector::new("tag".to_string(), "button".to_string(), 6);

        let id_score = SelectorGenerator::score_selector(&id_selector, &element);
        let tag_score = SelectorGenerator::score_selector(&tag_selector, &element);

        assert!(id_score > tag_score, "ID selector should score higher than tag selector");
    }
}

// Module exports are handled by the mod.rs file