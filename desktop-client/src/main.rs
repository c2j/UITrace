// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod models;
mod services;

use commands::recording::*;
use commands::script::*;
use commands::execution::*;
use crate::services::RecordingService;
use tauri::Manager;

#[tokio::main]
async fn main() {
    env_logger::init();

    // Initialize Tauri application
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Recording commands
            start_recording,
            stop_recording,
            pause_recording,
            resume_recording,

            // Script management commands
            load_script,
            save_script,
            delete_script,
            create_new_script,
            list_scripts,

            // Execution commands
            execute_script,
            stop_execution,
            pause_execution,
            resume_execution,

            // Data management commands
            load_data_file,
            get_data_preview,

            // Visual testing commands
            capture_baseline_screenshot,
            compare_screenshots,

            // Settings commands
            get_settings,
            update_settings,
            check_browser_driver,
        ])
        .setup(|app| {
            // Initialize services
            let _app_handle = app.handle();

            // Initialize recording service
            let recording_service = RecordingService::new();

            // Initialize app state with recording service
            let state = commands::recording::AppState {
                recording_sessions: Default::default(),
                recording_service: std::sync::Arc::new(recording_service),
            };
            app.manage(state);

            // Don't create window in setup - let Tauri handle it
            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::Focused(_) = event.event() {
                #[cfg(debug_assertions)]
                event.window().open_devtools();
            }
        })
        .menu(tauri::Menu::new())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}