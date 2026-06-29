use crate::db::Database;
use crate::models::{BatchTagOp, ExportData, ExportSummary, FolderTreeSummary, ImportResult, MediaFile, ScanConfig, ScanProgress, SearchQuery, TagInfo};
use crate::scanner::{scan_directory, ScanState};
use parking_lot::Mutex;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub scan_state: Arc<ScanState>,
}

pub fn db_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    dir.join("mediatagger.db")
}

#[tauri::command]
pub fn search_files(state: State<'_, AppState>, query: SearchQuery) -> Result<Vec<MediaFile>, String> {
    let db = state.db.lock();
    db.search_files(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_file(state: State<'_, AppState>, hash: String) -> Result<Option<MediaFile>, String> {
    let db = state.db.lock();
    db.get_file_by_hash(&hash).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_tag(
    state: State<'_, AppState>,
    hash: String,
    tag: String,
) -> Result<(), String> {
    let db = state.db.lock();
    db.add_tag(&hash, &tag.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_tag(
    state: State<'_, AppState>,
    hash: String,
    tag: String,
) -> Result<(), String> {
    let db = state.db.lock();
    db.remove_tag(&hash, &tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn batch_add_tags(state: State<'_, AppState>, op: BatchTagOp) -> Result<(), String> {
    let db = state.db.lock();
    for hash in &op.hashes {
        for tag in &op.tags {
            db.add_tag(hash, tag.trim()).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn batch_remove_tags(state: State<'_, AppState>, op: BatchTagOp) -> Result<(), String> {
    let db = state.db.lock();
    for hash in &op.hashes {
        for tag in &op.tags {
            db.remove_tag(hash, tag).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<TagInfo>, String> {
    let db = state.db.lock();
    db.list_tags().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn suggest_tags(
    state: State<'_, AppState>,
    prefix: String,
) -> Result<Vec<String>, String> {
    let db = state.db.lock();
    db.suggest_tags(&prefix, 10).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_tag(
    state: State<'_, AppState>,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let db = state.db.lock();
    db.rename_tag(&old_name, &new_name.trim())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_tag_global(state: State<'_, AppState>, tag_name: String) -> Result<(), String> {
    let db = state.db.lock();
    db.delete_tag_global(&tag_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn batch_delete_tags(state: State<'_, AppState>, tag_names: Vec<String>) -> Result<usize, String> {
    let db = state.db.lock();
    db.batch_delete_tags(&tag_names).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reconcile_files(state: State<'_, AppState>) -> Result<usize, String> {
    let db = state.db.lock();
    db.reconcile().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pause_scan(state: State<'_, AppState>) {
    state.scan_state.paused.store(true, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command]
pub fn resume_scan(state: State<'_, AppState>) {
    state.scan_state.paused.store(false, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, AppState>) {
    state.scan_state.cancelled.store(true, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command]
pub async fn start_scan(
    app: AppHandle,
    state: State<'_, AppState>,
    config: ScanConfig,
) -> Result<usize, String> {
    let scan_state = state.scan_state.clone();
    let db = state.db.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        let db = db.lock();
        scan_directory(&db, &config, scan_state, |scanned, total, current, status| {
            let progress = ScanProgress {
                scanned,
                total,
                current_path: current.to_string(),
                status: status.to_string(),
            };
            let _ = app.emit("scan-progress", &progress);
        })
    })
    .await
    .map_err(|e| e.to_string())?;

    result
}

#[tauri::command]
pub fn list_folder_tree(state: State<'_, AppState>) -> Result<FolderTreeSummary, String> {
    let db = state.db.lock();
    db.folder_tree_summary().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_tags(state: State<'_, AppState>, path: String) -> Result<ExportSummary, String> {
    let db = state.db.lock();
    let data = db.export_tag_data().map_err(|e| e.to_string())?;
    let entry_count = data.entries.len();
    let empty_tag_count = data.empty_tags.len();
    let mut unique_tags: std::collections::BTreeSet<String> = data
        .entries
        .iter()
        .flat_map(|e| e.tags.iter().cloned())
        .collect();
    unique_tags.extend(data.empty_tags.iter().cloned());
    let tag_count = unique_tags.len();
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(ExportSummary {
        entry_count,
        tag_count,
        empty_tag_count,
        path,
    })
}

#[tauri::command]
pub fn import_tags(
    state: State<'_, AppState>,
    path: String,
    mode: String,
) -> Result<ImportResult, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let content = content.trim();
    if content.is_empty() {
        return Err("导入文件为空".into());
    }
    let data: ExportData = serde_json::from_str(content).map_err(|e| e.to_string())?;
    let replace = mode == "replace";
    let db = state.db.lock();
    db.import_tag_data(&data, replace).map_err(|e| e.to_string())
}
