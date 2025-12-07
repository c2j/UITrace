use serde::{Deserialize, Serialize};
use std::hash::Hash;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum StepAction {
    #[serde(rename = "navigate")]
    Navigate,
    #[serde(rename = "click")]
    Click,
    #[serde(rename = "type")]
    Type,
    #[serde(rename = "clear")]
    Clear,
    #[serde(rename = "select")]
    Select,
    #[serde(rename = "scroll")]
    Scroll,
    #[serde(rename = "wait")]
    Wait,
    #[serde(rename = "assert_text")]
    AssertText,
    #[serde(rename = "assert_url")]
    AssertUrl,
    #[serde(rename = "assert_visible")]
    AssertVisible,
    #[serde(rename = "screenshot")]
    Screenshot,
    #[serde(rename = "execute_script")]
    ExecuteScript,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SelectorType {
    #[serde(rename = "id")]
    Id,
    #[serde(rename = "css")]
    Css,
    #[serde(rename = "xpath")]
    XPath,
    #[serde(rename = "name")]
    Name,
    #[serde(rename = "class")]
    Class,
    #[serde(rename = "tag")]
    Tag,
    #[serde(rename = "link_text")]
    LinkText,
    #[serde(rename = "partial_link_text")]
    PartialLinkText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Selector {
    #[serde(rename = "type")]
    pub selector_type: SelectorType,
    pub value: String,
    #[serde(default = "default_priority")]
    pub priority: i32,
}

impl Selector {
    pub fn new(selector_type: SelectorType, value: String, priority: i32) -> Self {
        Self {
            selector_type,
            value,
            priority,
        }
    }
}

impl Default for Selector {
    fn default() -> Self {
        Self {
            selector_type: SelectorType::Id,
            value: String::new(),
            priority: 1,
        }
    }
}

fn default_priority() -> i32 {
    1
}

impl Default for StepAction {
    fn default() -> Self {
        StepAction::Navigate
    }
}