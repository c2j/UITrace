use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub mod models;
pub mod recorder;
pub mod executor;
pub mod visual;
pub mod data;
pub mod services;
pub mod utils;

// Tauri command handlers
pub mod commands;

// Re-export commonly used types
pub use models::*;
pub use recorder::*;
pub use executor::*;
pub use visual::*;
pub use data::*;
pub use services::*;
pub use utils::*;

// Global application state
pub struct AppState {
    pub is_recording: Mutex<bool>,
    pub is_executing: Mutex<bool>,
    pub current_script: Mutex<Option<models::script::TestScript>>,
    pub browser_extension: Mutex<Option<recorder::browser_extension::BrowserExtension>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            is_recording: Mutex::new(false),
            is_executing: Mutex::new(false),
            current_script: Mutex::new(None),
            browser_extension: Mutex::new(None),
        }
    }
}

/// Initialize the application state
pub fn init_app_state(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(AppState::default());
    log::info!("UITrust application state initialized");
    Ok(())
}