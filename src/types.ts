export interface MediaFile {
  hash: string;
  path: string;
  filename: string;
  size: number;
  modified_time: number;
  file_type: string;
  status: number;
  tags: string[];
}

export interface TagInfo {
  id: number;
  name: string;
  count: number;
}

export interface ScanConfig {
  paths: string[];
  exclude_patterns: string[];
}

export interface ScanProgress {
  scanned: number;
  total: number;
  current_path: string;
  status: string;
}

export interface SearchQuery {
  query: string;
  logic: "AND" | "OR";
  tags: string[];
  file_types: string[];
  min_size?: number;
  max_size?: number;
  status?: number;
  has_tags?: boolean;
}

export interface BatchTagOp {
  hashes: string[];
  tags: string[];
}

export type FileTypeFilter = "all" | "image" | "video" | "audio" | "other";
export type StatusFilter = "all" | "active" | "lost";
export type TagPresenceFilter = "all" | "tagged" | "untagged";
export type ImportMode = "merge" | "replace";

export interface ExportSummary {
  entry_count: number;
  tag_count: number;
  empty_tag_count: number;
  path: string;
}

export interface ImportResult {
  imported_entries: number;
  imported_tags: number;
  imported_empty_tags: number;
  mode: string;
}
