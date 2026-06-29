mod commands;
mod db;
mod hash;
mod models;
mod scanner;

use commands::AppState;
use db::Database;
use parking_lot::Mutex;
use scanner::ScanState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db_path = commands::db_path(app.handle());
            let database = Database::new(&db_path).expect("Failed to initialize database");

            app.manage(AppState {
                db: Arc::new(Mutex::new(database)),
                scan_state: Arc::new(ScanState::new()),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::search_files,
            commands::get_file,
            commands::add_tag,
            commands::remove_tag,
            commands::batch_add_tags,
            commands::batch_remove_tags,
            commands::list_tags,
            commands::suggest_tags,
            commands::rename_tag,
            commands::delete_tag_global,
            commands::batch_delete_tags,
            commands::reconcile_files,
            commands::start_scan,
            commands::pause_scan,
            commands::resume_scan,
            commands::cancel_scan,
            commands::export_tags,
            commands::import_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
