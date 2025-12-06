#[cfg_attr(mobile, tauri::mobile_entry_point)]

use tauri::{
	menu::{Menu, MenuItem},
	tray::TrayIconBuilder,
	Manager
};

pub fn run() {
    tauri::Builder::default()
		.setup(|app| {
			let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
			let menu = Menu::with_items(app, &[&quit_i])?;

			let _tray = TrayIconBuilder::new()
				.menu(&menu)
				.show_menu_on_left_click(true)
				.icon(app.default_window_icon().unwrap().clone())
				.on_menu_event(|app, event| match event.id.as_ref() {
					"quit" => {
						app.exit(0);
					}
					other => {
						println!("menu item {} not handled", other);
					}
				})
				.build(app)?;

			// Initialize UITrust application state
			uitrace_desktop_lib::init_app_state(app.handle())?;

			Ok(())
		})
		.plugin(tauri_plugin_shell::init())
		.plugin(tauri_plugin_notification::init())
		.plugin(tauri_plugin_os::init())
		.plugin(tauri_plugin_fs::init())
		.plugin(tauri_plugin_store::Builder::new().build())
		.plugin(tauri_plugin_http::init())
		.invoke_handler(tauri::generate_handler![
			uitrace_desktop_lib::commands::recorder::start_recording,
			uitrace_desktop_lib::commands::recorder::stop_recording,
			uitrace_desktop_lib::commands::recorder::save_recording,
			uitrace_desktop_lib::commands::recorder::load_recording,
			uitrace_desktop_lib::commands::recorder::capture_dom_event,
			uitrace_desktop_lib::commands::executor::execute_script,
			uitrace_desktop_lib::commands::executor::stop_execution,
			uitrace_desktop_lib::commands::executor::get_execution_status,
			uitrace_desktop_lib::commands::visual::take_screenshot,
			uitrace_desktop_lib::commands::visual::compare_images,
			uitrace_desktop_lib::commands::visual::create_baseline,
			uitrace_desktop_lib::commands::data::load_test_data,
			uitrace_desktop_lib::commands::data::validate_test_data,
			uitrace_desktop_lib::commands::data::substitute_variables,
		])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
