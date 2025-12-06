use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementInfo {
    pub id: Option<String>,
    pub tag_name: String,
    pub class_name: Option<String>,
    pub text_content: Option<String>,
    pub attributes: HashMap<String, String>,
    pub bounding_rect: BoundingRect,
    pub form_data: Option<FormData>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormData {
    pub input_type: Option<String>,
    pub value: String,
    pub placeholder: Option<String>,
    pub name: Option<String>,
}