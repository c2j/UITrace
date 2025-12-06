use regex::Regex;
use std::collections::HashMap;

pub struct SelectorUtils {
    attribute_cache: HashMap<String, String>,
    css_to_xpath_cache: HashMap<String, String>,
}

impl SelectorUtils {
    pub fn new() -> Self {
        Self {
            attribute_cache: HashMap::new(),
            css_to_xpath_cache: HashMap::new(),
        }
    }

    /// Generate multiple selectors for the same element for fallback
    pub fn generate_selectors(&self, tag_name: &str, attributes: &HashMap<String, String>, text: Option<&str>) -> Vec<String> {
        let mut selectors = Vec::new();

        // 1. ID selector (most specific)
        if let Some(id) = attributes.get("id") {
            if !id.is_empty() {
                selectors.push(format!("#{}", self.escape_css_value(id)));
                selectors.push(format!("//*[@id={}]", self.escape_xpath_value(id)));
            }
        }

        // 2. Test ID or data-testid (common testing attributes)
        if let Some(test_id) = attributes.get("data-testid") {
            if !test_id.is_empty() {
                selectors.push(format!("[data-testid={}]", self.escape_css_value(test_id)));
            }
        }

        // 3. Class selector (combine all classes)
        if let Some(class) = attributes.get("class") {
            let classes: Vec<&str> = class.split_whitespace().collect();
            if !classes.is_empty() {
                selectors.push(format!("{}{}", tag_name, self.build_class_selector(&classes)));
            }
        }

        // 4. Attribute combination
        let mut attr_selectors = Vec::new();
        for (key, value) in attributes {
            if key != "id" && key != "class" && !value.is_empty() {
                attr_selectors.push(format!("[{}={}]", key, self.escape_css_value(value)));
            }
        }
        if !attr_selectors.is_empty() {
            selectors.push(format!("{}{}", tag_name, attr_selectors.join("")));
        }

        // 5. Text selector (if text is unique enough)
        if let Some(text) = text {
            if !text.trim().is_empty() && text.len() < 50 {
                let escaped_text = self.escape_xpath_value(text.trim());
                selectors.push(format!("//*[text()={}]", escaped_text));
                selectors.push(format!("//*[contains(text(), {})]", escaped_text));
            }
        }

        // 6. Tag with position (last resort)
        selectors.push(format!("{}[1]", tag_name));

        // Remove duplicates and return
        selectors.sort();
        selectors.dedup();
        selectors
    }

    /// Convert CSS selector to XPath
    pub fn css_to_xpath(&mut self, css: &str) -> String {
        if let Some(cached) = self.css_to_xpath_cache.get(css) {
            return cached.clone();
        }

        let xpath = self.convert_css_to_xpath_internal(css);
        self.css_to_xpath_cache.insert(css.to_string(), xpath.clone());
        xpath
    }

    /// Validate and escape CSS selector value
    pub fn escape_css_value(&self, value: &str) -> String {
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\'', "\\\'")
            .replace('#', "\\#")
            .replace('.', "\\.")
            .replace(':', "\\:")
            .replace('[', "\\[")
            .replace(']', "\\]")
            .replace('(', "\\(")
            .replace(')', "\\)")
    }

    /// Validate and escape XPath value
    pub fn escape_xpath_value(&self, value: &str) -> String {
        if value.contains('"') {
            if value.contains('\'') {
                // Contains both quotes - use concat
                let parts: Vec<String> = value
                    .split('"')
                    .enumerate()
                    .map(|(i, part)| {
                        if i % 2 == 0 {
                            format!("'{}'", part)
                        } else {
                            format!("\"{}\"", part)
                        }
                    })
                    .collect();
                format!("concat({})", parts.join(","))
            } else {
                // Contains only double quotes - wrap in single quotes
                format!("'{}'", value)
            }
        } else {
            // No double quotes - wrap in double quotes
            format!("\"{}\"", value)
        }
    }

    /// Build class selector from list of classes
    fn build_class_selector(&self, classes: &[&str]) -> String {
        classes
            .iter()
            .map(|class| format!(".{}", self.escape_css_value(class)))
            .collect()
    }

    /// Internal CSS to XPath conversion
    fn convert_css_to_xpath_internal(&self, css: &str) -> String {
        // This is a simplified implementation
        // A real implementation would handle all CSS selectors
        let mut xpath = "//".to_string();
        let mut parts = css.split_whitespace().peekable();

        while let Some(part) = parts.next() {
            if part.starts_with('#') {
                // ID selector
                xpath.push_str(&format!("*[@id={}]", self.escape_xpath_value(&part[1..])));
            } else if part.starts_with('.') {
                // Class selector
                xpath.push_str(&format!("*[contains(@class, {})]", self.escape_xpath_value(&part[1..])));
            } else if part.contains('[') && part.contains(']') {
                // Attribute selector
                let re = Regex::new(r"^(.+?)\[(.+?)\]$").unwrap();
                if let Some(caps) = re.captures(part) {
                    let tag = caps.get(1).unwrap().as_str();
                    let attr = caps.get(2).unwrap().as_str();
                    xpath.push_str(tag);
                    xpath.push('[');
                    xpath.push_str(&self.convert_attribute_to_xpath(attr));
                    xpath.push(']');
                } else {
                    xpath.push_str(part);
                }
            } else {
                // Tag or element
                xpath.push_str(part);
            }

            if parts.peek().is_some() {
                xpath.push('/');
            }
        }

        xpath
    }

    /// Convert CSS attribute selector to XPath
    fn convert_attribute_to_xpath(&self, attr: &str) -> String {
        if attr.contains('=') {
            if attr.starts_with('^') {
                // Starts with
                let parts: Vec<&str> = attr[1..].split('=').collect();
                format!("starts-with(@{}, {})", parts[0], self.escape_xpath_value(parts[1]))
            } else if attr.starts_with('$') {
                // Ends with
                let parts: Vec<&str> = attr[1..].split('=').collect();
                format!("substring(@{}, string-length(@{}) - string-length({}) + 1) = {}",
                    parts[0], parts[0], self.escape_xpath_value(parts[1]), self.escape_xpath_value(parts[1]))
            } else if attr.starts_with('*') {
                // Contains
                let parts: Vec<&str> = attr[1..].split('=').collect();
                format!("contains(@{}, {})", parts[0], self.escape_xpath_value(parts[1]))
            } else {
                // Exact match
                attr.to_string()
            }
        } else {
            // Presence check
            format!("@{}", attr)
        }
    }

    /// Calculate selector specificity (higher = more specific)
    pub fn calculate_specificity(&self, selector: &str) -> u32 {
        let mut specificity = 0;

        // ID selectors (#id)
        let id_re = Regex::new(r"#([a-zA-Z][\w-]*)").unwrap();
        specificity += id_re.find_iter(selector).count() as u32 * 100;

        // Class selectors (.class), attribute selectors ([attr]), pseudo-classes
        let class_re = Regex::new(r"\.([a-zA-Z][\w-]*)|\[[^\]]+\]|:[a-zA-Z-]+").unwrap();
        specificity += class_re.find_iter(selector).count() as u32 * 10;

        // Element selectors
        let element_re = Regex::new(r"^[a-zA-Z-]+|[\s>+~,][a-zA-Z-]+").unwrap();
        specificity += element_re.find_iter(selector).count() as u32;

        specificity
    }

    /// Sort selectors by specificity
    pub fn sort_selectors_by_specificity(&self, selectors: &mut Vec<String>) {
        selectors.sort_by(|a, b| {
            let spec_a = self.calculate_specificity(a);
            let spec_b = self.calculate_specificity(b);
            spec_b.cmp(&spec_a) // Descending order
        });
    }
}

impl Default for SelectorUtils {
    fn default() -> Self {
        Self::new()
    }
}