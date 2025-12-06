pub mod web_recorder;
pub mod event_capture;
pub mod selector_generator;
pub mod browser_extension;
pub mod config;
pub mod element_info;

pub use web_recorder::WebRecorder;
pub use event_capture::{EventCapture, DomEvent, EventCaptureError};
pub use selector_generator::SelectorGenerator;
pub use browser_extension::BrowserExtension;
pub use config::RecordingConfig;
pub use element_info::{ElementInfo, BoundingRect, FormData};