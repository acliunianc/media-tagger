use serde::{Deserialize, Serialize};

fn default_version() -> u32 {
    1
}

fn default_app_name() -> String {
    "MediaTagger".into()
}

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
    pub has_tags: Option<bool>,
    pub folder_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderNode {
    pub path: String,
    pub name: String,
    pub file_count: u32,
    #[serde(default)]
    pub children: Vec<FolderNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderTreeSummary {
    pub total_files: u32,
    pub roots: Vec<FolderNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTagOp {
    pub hashes: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportEntry {
    pub hash: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub exported_at: String,
    #[serde(default = "default_app_name")]
    pub app: String,
    #[serde(default)]
    pub entries: Vec<ExportEntry>,
    /// 没有任何文件关联的全局标签
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub empty_tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSummary {
    pub entry_count: usize,
    pub tag_count: usize,
    pub empty_tag_count: usize,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported_entries: usize,
    pub imported_tags: usize,
    pub imported_empty_tags: usize,
    pub mode: String,
}
