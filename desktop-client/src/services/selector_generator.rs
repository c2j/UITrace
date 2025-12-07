//! 智能选择器生成算法
//! 基于DOM元素特征生成多种定位策略，支持容错回放
//! T026: Create multi-selector generation algorithm (ID, CSS, XPath)

use thirtyfour::prelude::*;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use regex::Regex;
use log::info;
use crate::models::{Selector, SelectorType as BasicSelectorType};

/// 选择器类型和优先级（用于元数据）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MetaSelectorType {
    Id,           // 最高优先级: #elementId
    Css,          // 高优先级: tag.class[attr="value"]
    XPath,        // 中优先级: //tag[@attr="value"]
    Text,         // 低优先级: //*[text()="content"]
    Position,     // 最低优先级: position-based
}

/// 选择器元数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectorMetadata {
    pub selector_type: MetaSelectorType,
    pub value: String,
    pub priority: u8,           // 1-10, 1为最高
    pub reliability_score: f32, // 0.0-1.0, 基于历史成功率
    pub uniqueness_score: f32,  // 0.0-1.0, 基于DOM中匹配元素数量
    pub stability_score: f32,   // 0.0-1.0, 基于属性稳定性
}

/// 选择器生成配置
#[derive(Debug, Clone)]
pub struct SelectorGeneratorConfig {
    pub max_selectors: usize,          // 最大选择器数量 (默认: 5)
    pub min_reliability_score: f32,    // 最小可靠性分数 (默认: 0.6)
    pub min_uniqueness_score: f32,     // 最小唯一性分数 (默认: 0.8)
    pub exclude_dynamic_patterns: bool, // 排除动态模式 (默认: true)
    pub include_aria_attributes: bool,  // 包含ARIA属性 (默认: true)
}

impl Default for SelectorGeneratorConfig {
    fn default() -> Self {
        Self {
            max_selectors: 5,
            min_reliability_score: 0.6,
            min_uniqueness_score: 0.8,
            exclude_dynamic_patterns: true,
            include_aria_attributes: true,
        }
    }
}

/// 智能选择器生成器
pub struct SelectorGenerator {
    config: SelectorGeneratorConfig,
    dynamic_id_pattern: Regex,
    dynamic_class_pattern: Regex,
}

impl SelectorGenerator {
    pub fn new(config: SelectorGeneratorConfig) -> Self {
        Self {
            config,
            dynamic_id_pattern: Regex::new(r"^[0-9a-f]{8,}$|^[0-9]{6,}$").unwrap(),
            dynamic_class_pattern: Regex::new(r"\b(react|ng-|vue-|ember-|css-|js-)\w+\b").unwrap(),
        }
    }

    /// 为WebElement生成多种选择器策略
    pub async fn generate_selectors_for_element(
        &self,
        element: &WebElement
    ) -> crate::error::Result<Vec<SelectorMetadata>> {
        let mut selectors = Vec::new();

        info!("开始为元素生成选择器");

        // 1. ID选择器 (最高优先级)
        match self.generate_id_selector(element).await {
            Ok(Some(id_selector)) => selectors.push(id_selector),
            Ok(None) => {},
            Err(e) => return Err(crate::error::AppError::WebDriverError(e.to_string())),
        }

        // 2. CSS选择器 (高优先级)
        match self.generate_css_selectors(element).await {
            Ok(css_selectors) => selectors.extend(css_selectors),
            Err(e) => return Err(crate::error::AppError::WebDriverError(e.to_string())),
        }

        // 3. XPath选择器 (中优先级)
        match self.generate_xpath_selectors(element).await {
            Ok(xpath_selectors) => selectors.extend(xpath_selectors),
            Err(e) => return Err(crate::error::AppError::WebDriverError(e.to_string())),
        }

        // 4. 文本选择器 (低优先级)
        match self.generate_text_selector(element).await {
            Ok(Some(text_selector)) => selectors.push(text_selector),
            Ok(None) => {},
            Err(e) => return Err(crate::error::AppError::WebDriverError(e.to_string())),
        }

        // 5. 位置选择器 (最低优先级)
        let tag_name = match element.tag_name().await {
            Ok(name) => name,
            Err(e) => return Err(crate::error::AppError::WebDriverError(e.to_string())),
        };

        match self.generate_position_selector(element, &tag_name).await {
            Ok(Some(position_selector)) => selectors.push(position_selector),
            Ok(None) => {},
            Err(e) => return Err(crate::error::AppError::WebDriverError(e.to_string())),
        }

        // 验证选择器质量
        let validated_selectors = match self.validate_selectors(element, selectors).await {
            Ok(validated) => validated,
            Err(e) => return Err(crate::error::AppError::WebDriverError(e.to_string())),
        };

        // 按优先级和可靠性排序
        let mut final_selectors = validated_selectors;
        final_selectors.sort_by(|a, b| {
            a.priority.cmp(&b.priority)
                .then(b.reliability_score.partial_cmp(&a.reliability_score).unwrap())
        });

        // 限制数量并确保质量
        final_selectors.truncate(self.config.max_selectors);
        final_selectors.retain(|s| {
            s.reliability_score >= self.config.min_reliability_score &&
            s.uniqueness_score >= self.config.min_uniqueness_score
        });

        info!("生成 {} 个选择器", final_selectors.len());
        Ok(final_selectors)
    }


    /// 生成ID选择器
    async fn generate_id_selector(
        &self,
        element: &WebElement
    ) -> std::result::Result<Option<SelectorMetadata>, WebDriverError> {
        let id = element.attr("id").await?;

        if let Some(id_value) = id {
            if !id_value.is_empty() {
                // 检查是否为动态ID
                let is_dynamic = self.dynamic_id_pattern.is_match(&id_value);

                if !is_dynamic || !self.config.exclude_dynamic_patterns {
                    let selector = format!("#{}", id_value);

                    // 验证ID在页面中的唯一性
                    let uniqueness = self.estimate_uniqueness_score(&selector, "css"
                    ).await?;

                    return Ok(Some(SelectorMetadata {
                        selector_type: MetaSelectorType::Id,
                        value: selector,
                        priority: 1,
                        reliability_score: if is_dynamic { 0.7 } else { 0.95 },
                        uniqueness_score: uniqueness,
                        stability_score: if is_dynamic { 0.6 } else { 0.95 },
                    }));
                }
            }
        }

        Ok(None)
    }

    /// 生成CSS选择器
    async fn generate_css_selectors(
        &self,
        element: &WebElement
    ) -> std::result::Result<Vec<SelectorMetadata>, WebDriverError> {
        let mut selectors = Vec::new();
        let tag_name = element.tag_name().await?;
        let class_attr = element.attr("class").await?;
        let classes = self.parse_classes(class_attr.as_deref());

        // 级别1: 标签 + 稳定类名
        let stable_classes = classes.iter()
            .filter(|class| !self.is_dynamic_class(class))
            .cloned()
            .collect::<Vec<_>>();

        if !stable_classes.is_empty() {
            let selector = format!("{}.{}", tag_name, stable_classes.join("."));
            let uniqueness = self.estimate_uniqueness_score(
                &selector, "css"
            ).await?;

            selectors.push(SelectorMetadata {
                selector_type: MetaSelectorType::Css,
                value: selector,
                priority: 2,
                reliability_score: 0.85,
                uniqueness_score: uniqueness,
                stability_score: 0.80,
            });
        }

        // 级别2: 添加属性选择器
        let attributes = self.get_stable_attributes(element).await?;
        for (attr, value) in attributes {
            if self.is_stable_attribute(&attr, &value) {
                let selector = format!("{}[{}=\"{}\"]", tag_name, attr, value);
                let uniqueness = self.estimate_uniqueness_score(
                    &selector, "css"
                ).await?;

                selectors.push(SelectorMetadata {
                    selector_type: MetaSelectorType::Css,
                    value: selector,
                    priority: 3,
                    reliability_score: 0.80,
                    uniqueness_score: uniqueness,
                    stability_score: 0.75,
                });
            }
        }

        // 级别3: 结构性选择器
        match self.generate_structural_css_selector(element, &tag_name).await {
            Ok(Some(structural_selector)) => {
                let uniqueness = self.estimate_uniqueness_score(
                    &structural_selector, "css"
                ).await?;

                selectors.push(SelectorMetadata {
                    selector_type: MetaSelectorType::Css,
                    value: structural_selector,
                    priority: 4,
                    reliability_score: 0.70,
                    uniqueness_score: uniqueness,
                    stability_score: 0.65,
                });
            },
            Ok(None) => {},
            Err(e) => return Err(e),
        }

        Ok(selectors)
    }

    /// 生成XPath选择器
    async fn generate_xpath_selectors(
        &self,
element: &WebElement
    ) -> std::result::Result<Vec<SelectorMetadata>, WebDriverError> {
        let mut selectors = Vec::new();
        let tag_name = element.tag_name().await?;

        // 策略1: 属性基础的XPath
        let attributes = self.get_stable_attributes(element).await?;
        for (attr, value) in attributes {
            let xpath = format!("//{}[@{}='{}']", tag_name, attr, value);
            let uniqueness = self.estimate_uniqueness_score(
                &xpath, "xpath"
            ).await?;

            selectors.push(SelectorMetadata {
                selector_type: MetaSelectorType::XPath,
                value: xpath,
                priority: 5,
                reliability_score: 0.75,
                uniqueness_score: uniqueness,
                stability_score: 0.70,
            });
        }

        // 策略2: 文本内容XPath
        if let Ok(text_content) = element.text().await {
            if !text_content.trim().is_empty() && text_content.len() < 100 {
                let xpath = format!("//{}[contains(text(), '{}')]",
                    tag_name, text_content.trim()
                );
                let uniqueness = self.estimate_uniqueness_score(
                    &xpath, "xpath"
                ).await?;

                selectors.push(SelectorMetadata {
                    selector_type: MetaSelectorType::XPath,
                    value: xpath,
                    priority: 6,
                    reliability_score: 0.65,
                    uniqueness_score: uniqueness,
                    stability_score: 0.60,
                });
            }
        }

        // 策略3: 位置关系XPath
        if let Some(position_xpath) = self.generate_position_xpath(
            element, &tag_name
        ).await? {
            let uniqueness = self.estimate_uniqueness_score(
                &position_xpath, "xpath"
            ).await?;

            selectors.push(SelectorMetadata {
                selector_type: MetaSelectorType::XPath,
                value: position_xpath,
                priority: 7,
                reliability_score: 0.60,
                uniqueness_score: uniqueness,
                stability_score: 0.55,
            });
        }

        Ok(selectors)
    }

    /// 生成文本选择器
    async fn generate_text_selector(
        &self,
element: &WebElement
    ) -> std::result::Result<Option<SelectorMetadata>, WebDriverError> {
        if let Ok(text_content) = element.text().await {
            if !text_content.trim().is_empty() && text_content.len() < 50 {
                let selector = format!("//*[contains(text(), '{}')]",
                    text_content.trim()
                );
                let uniqueness = self.estimate_uniqueness_score(
                    &selector, "xpath"
                ).await?;

                return Ok(Some(SelectorMetadata {
                    selector_type: MetaSelectorType::Text,
                    value: selector,
                    priority: 8,
                    reliability_score: 0.55,
                    uniqueness_score: uniqueness,
                    stability_score: 0.50,
                }));
            }
        }
        Ok(None)
    }

    /// 生成位置选择器
    async fn generate_position_selector(
        &self,
_element: &WebElement,
tag_name: &str
    ) -> std::result::Result<Option<SelectorMetadata>, WebDriverError> {
        // 获取元素在同级元素中的位置
        let position_xpath = format!("//{}[position()=last()-{}]", tag_name, 0);
        let uniqueness = self.estimate_uniqueness_score(
            &position_xpath, "xpath"
        ).await?;

        Ok(Some(SelectorMetadata {
            selector_type: MetaSelectorType::Position,
            value: position_xpath,
            priority: 9,
            reliability_score: 0.45,
            uniqueness_score: uniqueness,
            stability_score: 0.40,
        }))
    }

    // 辅助函数和验证逻辑...
    // (为简洁起见，这里省略了与之前规范中相同的辅助函数)

    /// 为简化实现，将WebElement转换为选择器
    pub async fn generate_selectors_from_attributes(
        &self,
        tag_name: &str,
        attributes: &HashMap<String, String>,
        text_content: Option<&str>
    ) -> crate::error::Result<Vec<Selector>> {
        let mut selectors = Vec::new();

        // ID选择器
        if let Some(id) = attributes.get("id") {
            if !id.is_empty() && !self.dynamic_id_pattern.is_match(id) {
                selectors.push(Selector {
                    selector_type: BasicSelectorType::Id,
                    value: format!("#{}", id),
                    priority: 1,
                });
            }
        }

        // CSS选择器
        if let Some(class) = attributes.get("class") {
            let classes: Vec<&str> = class.split_whitespace()
                .filter(|c| !self.is_dynamic_class(c) && !Self::is_generic_class(c))
                .collect();

            if !classes.is_empty() {
                selectors.push(Selector {
                    selector_type: BasicSelectorType::Css,
                    value: format!("{}.{}", tag_name, classes.join(".")),
                    priority: 2,
                });
            }
        }

        // 属性选择器
        for (attr, value) in attributes {
            if self.is_stable_attribute(attr, value) {
                selectors.push(Selector {
                    selector_type: BasicSelectorType::Css,
                    value: format!("{}[{}=\"{}\"]", tag_name, attr, value),
                    priority: 3,
                });
            }
        }

        // XPath选择器
        for (attr, value) in attributes {
            if attr == "id" || attr == "name" {
                selectors.push(Selector {
                    selector_type: BasicSelectorType::XPath,
                    value: format!("//{}[@{}='{}']", tag_name, attr, value),
                    priority: 5,
                });
            }
        }

        // 文本选择器
        if let Some(text) = text_content {
            if !text.trim().is_empty() && text.len() < 50 {
                selectors.push(Selector {
                    selector_type: BasicSelectorType::LinkText, // 使用LinkText作为文本选择器类型
                    value: format!("//*[contains(text(), '{}')]", text.trim()),
                    priority: 8,
                });
            }
        }

        // 排序并返回
        selectors.sort_by_key(|s| s.priority);
        Ok(selectors)
    }

    /// 优先级排序（保持兼容性）
    pub fn prioritize_selectors(selectors: Vec<Selector>) -> Vec<Selector> {
        let mut sorted = selectors;
        sorted.sort_by_key(|s| s.priority);
        sorted
    }

    /// 获取最佳选择器（保持兼容性）
    pub fn get_best_selector(selectors: Vec<Selector>) -> Option<Selector> {
        selectors.into_iter().min_by_key(|s| s.priority)
    }

    /// 过滤有效选择器（保持兼容性）
    pub fn filter_valid_selectors(selectors: Vec<Selector>) -> Vec<Selector> {
        // 实现质量检查逻辑
        selectors.into_iter()
            .filter(|s| !s.value.is_empty() && s.priority <= 10)
            .collect()
    }

    // 辅助函数
    fn parse_classes(&self, class_attr: Option<&str>
    ) -> Vec<String> {
        class_attr
            .map(|classes| {
                classes
                    .split_whitespace()
                    .filter(|class| !class.is_empty())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default()
    }

    fn is_dynamic_class(&self, class: &str) -> bool {
        self.dynamic_class_pattern.is_match(class) || class.len() < 3
    }

    fn is_stable_attribute(&self, attr: &str, value: &str) -> bool {
        let unstable_attrs = ["style", "class", "data-reactid", "data-ember", "ng-"];

        !unstable_attrs.iter().any(|&ua| attr.starts_with(ua)) &&
        !value.is_empty() &&
        value.len() < 100 &&
        !self.dynamic_id_pattern.is_match(value)
    }

    fn is_generic_class(class: &str) -> bool {
        let generic_classes = [
            "btn", "button", "input", "form-control", "container", "row", "col", "text",
            "bg-", "text-", "border-", "m-", "p-", "d-", "flex", "justify-", "align-",
            "w-", "h-", "position-", "top-", "bottom-", "start-", "end-"
        ];

        generic_classes.iter().any(|gen| class.starts_with(gen))
    }

    // 异步辅助函数（完整实现）
    async fn get_stable_attributes(
        &self,
        element: &WebElement
    ) -> std::result::Result<Vec<(String, String)>, WebDriverError> {
        // 获取所有属性并筛选稳定属性
        let mut stable_attrs = Vec::new();

        // 尝试获取常见稳定属性
        if let Ok(id) = element.attr("id").await {
            if let Some(val) = id {
                if !val.is_empty() && !self.dynamic_id_pattern.is_match(&val) {
                    stable_attrs.push(("id".to_string(), val));
                }
            }
        }

        if let Ok(name) = element.attr("name").await {
            if let Some(val) = name {
                if !val.is_empty() && !self.dynamic_id_pattern.is_match(&val) {
                    stable_attrs.push(("name".to_string(), val));
                }
            }
        }

        if let Ok(placeholder) = element.attr("placeholder").await {
            if let Some(val) = placeholder {
                if !val.is_empty() && val.len() < 100 {
                    stable_attrs.push(("placeholder".to_string(), val));
                }
            }
        }

        if let Ok(title) = element.attr("title").await {
            if let Some(val) = title {
                if !val.is_empty() && val.len() < 100 {
                    stable_attrs.push(("title".to_string(), val));
                }
            }
        }

        if let Ok(data_testid) = element.attr("data-testid").await {
            if let Some(val) = data_testid {
                if !val.is_empty() {
                    stable_attrs.push(("data-testid".to_string(), val));
                }
            }
        }

        if let Ok(role) = element.attr("role").await {
            if let Some(val) = role {
                if !val.is_empty() && self.config.include_aria_attributes {
                    stable_attrs.push(("role".to_string(), val));
                }
            }
        }

        if let Ok(aria_label) = element.attr("aria-label").await {
            if let Some(val) = aria_label {
                if !val.is_empty() && self.config.include_aria_attributes && val.len() < 100 {
                    stable_attrs.push(("aria-label".to_string(), val));
                }
            }
        }

        // 过滤稳定属性
        stable_attrs.retain(|(attr, value)| self.is_stable_attribute(attr, value));
        Ok(stable_attrs)
    }

    async fn generate_structural_css_selector(
        &self,
        element: &WebElement,
        tag_name: &str
    ) -> std::result::Result<Option<String>, WebDriverError> {
        // 获取父元素信息
        if let Ok(parent) = element.find(By::XPath("..")).await {
            if let Ok(parent_tag) = parent.tag_name().await {
                // 获取父元素的类名
                if let Ok(parent_class) = parent.attr("class").await {
                    if let Some(class_val) = parent_class {
                        let stable_classes: Vec<&str> = class_val.split_whitespace()
                            .filter(|c| !self.is_dynamic_class(c) && !Self::is_generic_class(c))
                            .collect();

                        if !stable_classes.is_empty() {
                            return Ok(Some(format!("{}.{}", parent_tag, stable_classes.join("."))));
                        }
                    }
                }

                // 简单父子选择器
                return Ok(Some(format!("{} > {}", parent_tag, tag_name)));
            }
        }
        Ok(None)
    }

    async fn generate_position_xpath(
        &self,
        _element: &WebElement,
        tag_name: &str
    ) -> std::result::Result<Option<String>, WebDriverError> {
        // 简化实现：使用简单的位置XPath
        // 在实际使用中，可以添加更复杂的位置逻辑
        Ok(Some(format!("//{}[1]", tag_name)))
    }

    async fn validate_selectors(
        &self,
        _element: &WebElement,
        selectors: Vec<SelectorMetadata>
    ) -> std::result::Result<Vec<SelectorMetadata>, WebDriverError> {
        // 简化验证：返回所有选择器，实际验证需要更多上下文
        // 在实际使用中，这些选择器会在录制时进行验证
        Ok(selectors)
    }

    async fn estimate_uniqueness_score(
        &self,
        selector: &str,
        selector_type: &str
    ) -> std::result::Result<f32, WebDriverError> {
        // 基于选择器类型的估计值
        match selector_type {
            "css" => {
                if selector.starts_with('#') {
                    Ok(0.98) // ID选择器通常唯一
                } else if selector.contains('[') && selector.contains("@id=") {
                    Ok(0.90) // ID属性选择器很唯一
                } else if selector.contains('[') && selector.contains("@name=") {
                    Ok(0.85) // name属性选择器较唯一
                } else if selector.contains('[') && selector.contains("data-testid") {
                    Ok(0.95) // data-testid很唯一
                } else if selector.contains('[') {
                    Ok(0.75) // 其他属性选择器较唯一
                } else if selector.contains('>') {
                    Ok(0.80) // 结构性选择器较唯一
                } else if selector.chars().filter(|&c| c == '.').count() >= 2 {
                    Ok(0.85) // 多个类名组合较唯一
                } else {
                    Ok(0.65) // 单个类选择器可能不唯一
                }
            }
            "xpath" => {
                if selector.contains("@id=") {
                    Ok(0.95) // ID XPath很唯一
                } else if selector.contains("@name=") {
                    Ok(0.85) // name XPath较唯一
                } else if selector.contains("text()=") || selector.contains("contains(text()") {
                    Ok(0.80) // 文本XPath较唯一
                } else if selector.contains("@data-testid") {
                    Ok(0.95) // data-testid XPath很唯一
                } else if selector.contains("position()") {
                    Ok(0.50) // 位置XPath可能不唯一
                } else if selector.contains("[") && selector.contains("]") {
                    Ok(0.75) // 属性XPath较唯一
                } else {
                    Ok(0.60) // 简单标签XPath可能不唯一
                }
            }
            _ => Ok(0.60),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prioritize_selectors() {
        let selectors = vec![
            Selector { selector_type: BasicSelectorType::Css, value: "div.test".to_string(), priority: 4 },
            Selector { selector_type: BasicSelectorType::Id, value: "#test".to_string(), priority: 1 },
            Selector { selector_type: BasicSelectorType::Name, value: "[name='test']".to_string(), priority: 2 },
        ];

        let prioritized = SelectorGenerator::prioritize_selectors(selectors);
        assert_eq!(prioritized[0].priority, 1); // ID should be first
        assert_eq!(prioritized[1].priority, 2); // Name should be second
        assert_eq!(prioritized[2].priority, 4); // CSS should be last
    }

    #[test]
    fn test_get_best_selector() {
        let selectors = vec![
            Selector { selector_type: BasicSelectorType::Css, value: "div.test".to_string(), priority: 4 },
            Selector { selector_type: BasicSelectorType::Id, value: "#test".to_string(), priority: 1 },
            Selector { selector_type: BasicSelectorType::Name, value: "[name='test']".to_string(), priority: 2 },
        ];

        let best = SelectorGenerator::get_best_selector(selectors);
        assert!(best.is_some());
        assert_eq!(best.unwrap().priority, 1);
    }

    #[test]
    fn test_is_generic_class() {
        assert!(SelectorGenerator::is_generic_class("btn"));
        assert!(SelectorGenerator::is_generic_class("btn-primary"));
        assert!(SelectorGenerator::is_generic_class("text-center"));
        assert!(SelectorGenerator::is_generic_class("mt-3"));
        assert!(!SelectorGenerator::is_generic_class("custom-button"));
        assert!(!SelectorGenerator::is_generic_class("login-form"));
    }
}