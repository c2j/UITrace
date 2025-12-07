pub mod recording;
pub mod selector_generator;
pub mod browser_session;
pub mod script_service;
pub mod browser_injection;

// Re-export main types for convenience
pub use recording::{RecordingService, RecordingSession, RecordedStep};
pub use selector_generator::SelectorGenerator;
pub use browser_session::{BrowserSessionManager, BrowserSession, BrowserType, BrowserCapabilities};
pub use script_service::{ScriptService, ScriptMetadata, ScriptStatus, SerializedScript};
pub use browser_injection::{BrowserInjectionService, UserInteractionEvent, ScrollDirection};