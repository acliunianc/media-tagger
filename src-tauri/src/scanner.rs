use crate::db::Database;
use crate::hash::detect_file_type;
use crate::models::ScanConfig;
use glob::Pattern;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use walkdir::WalkDir;

const MEDIA_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "tiff", "tif",
    "mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "m4v",
    "mp3", "wav", "flac", "aac", "ogg", "wma", "m4a",
];

pub struct ScanState {
    pub paused: AtomicBool,
    pub cancelled: AtomicBool,
}

impl ScanState {
    pub fn new() -> Self {
        Self {
            paused: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
        }
    }

    pub fn reset(&self) {
        self.paused.store(false, Ordering::SeqCst);
        self.cancelled.store(false, Ordering::SeqCst);
    }
}

fn is_media_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MEDIA_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn should_exclude(path: &Path, patterns: &[Pattern]) -> bool {
    let path_str = path.to_string_lossy().replace('\\', "/");
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    for pattern in patterns {
        if pattern.matches(&path_str) || pattern.matches(filename) {
            return true;
        }
        if path.is_dir() && pattern.matches(&format!("{}/", path_str)) {
            return true;
        }
    }
    false
}

pub fn collect_files(config: &ScanConfig) -> Vec<PathBuf> {
    let patterns: Vec<Pattern> = config
        .exclude_patterns
        .iter()
        .filter_map(|p| Pattern::new(p).ok())
        .collect();

    let mut files = Vec::new();

    for root in &config.paths {
        let root_path = PathBuf::from(root);
        if !root_path.exists() {
            continue;
        }

        if root_path.is_file() {
            if is_media_file(&root_path) && !should_exclude(&root_path, &patterns) {
                files.push(root_path);
            }
            continue;
        }

        for entry in WalkDir::new(&root_path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if should_exclude(path, &patterns) {
                if path.is_dir() {
                    continue;
                }
            }
            if path.is_file() && is_media_file(path) && !should_exclude(path, &patterns) {
                files.push(path.to_path_buf());
            }
        }
    }

    files.sort();
    files.dedup();
    files
}

pub fn scan_directory<F>(
    db: &Database,
    config: &ScanConfig,
    scan_state: Arc<ScanState>,
    mut on_progress: F,
) -> Result<usize, String>
where
    F: FnMut(usize, usize, &str, &str),
{
    scan_state.reset();
    let files = collect_files(config);
    let total = files.len();
    let mut processed = 0usize;

    on_progress(0, total, "", "scanning");

    for (i, file_path) in files.iter().enumerate() {
        if scan_state.cancelled.load(Ordering::SeqCst) {
            on_progress(i, total, "", "cancelled");
            return Ok(processed);
        }

        while scan_state.paused.load(Ordering::SeqCst) {
            on_progress(i, total, &file_path.to_string_lossy(), "paused");
            std::thread::sleep(std::time::Duration::from_millis(100));
            if scan_state.cancelled.load(Ordering::SeqCst) {
                on_progress(i, total, "", "cancelled");
                return Ok(processed);
            }
        }

        let path_str = file_path.to_string_lossy().to_string();
        on_progress(i + 1, total, &path_str, "scanning");

        if let Err(e) = db.process_file(file_path) {
            eprintln!("Error processing {}: {}", path_str, e);
        } else {
            processed += 1;
        }
    }

    on_progress(total, total, "", "done");
    Ok(processed)
}

pub fn get_file_type_label(path: &Path) -> String {
    detect_file_type(path)
}
