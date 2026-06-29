use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaFile {
    pub hash: String,
    pub path: String,
    pub filename: String,
    pub size: i64,
    pub modified_time: i64,
    pub file_type: String,
    pub status: i32,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo {
    pub id: i64,
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanConfig {
    pub paths: Vec<String>,
    pub exclude_patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub scanned: usize,
    pub total: usize,
    pub current_path: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub logic: String,
    pub tags: Vec<String>,
    pub file_types: Vec<String>,
    pub min_size: Option<i64>,
    pub max_size: Option<i64>,
    pub status: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTagOp {
    pub hashes: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportEntry {
    pub hash: String,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub version: u32,
    pub exported_at: String,
    pub app: String,
    pub entries: Vec<ExportEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSummary {
    pub entry_count: usize,
    pub tag_count: usize,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported_entries: usize,
    pub imported_tags: usize,
    pub mode: String,
}
