// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use uitrace_desktop::commands;

#[tokio::main]
async fn main() {
    // Initialize logger
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    log::info!("Starting UITrace Desktop Application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize application state
            log::info!("Setting up UITrace application");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::recorder::start_recording,
            commands::recorder::stop_recording,
            commands::recorder::save_recording,
            commands::recorder::load_recording,
            commands::recorder::capture_dom_event,
            commands::executor::execute_script,
            commands::executor::stop_execution,
            commands::executor::get_execution_status,
            // Visual commands will be enabled in User Story 4
            // Data commands will be enabled in User Story 3
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}