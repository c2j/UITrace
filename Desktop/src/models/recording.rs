use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recording {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub events: Vec<RecordedEvent>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedEvent {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub event_type: EventType,
    pub target: EventTarget,
    pub data: EventData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    Click,
    Input,
    Hover,
    Scroll,
    Navigate,
    Wait,
    Screenshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventTarget {
    pub selector: String,
    pub tag_name: String,
    pub text: Option<String>,
    pub attributes: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventData {
    Click {
        button: Option<String>,
        modifiers: Vec<String>,
    },
    Input {
        value: String,
        input_type: String,
    },
    Hover,
    Scroll {
        x: i32,
        y: i32,
    },
    Navigate {
        url: String,
    },
    Wait {
        duration: u32,
    },
    Screenshot {
        path: PathBuf,
    },
}