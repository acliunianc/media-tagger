import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type {
  BatchTagOp,
  ExportSummary,
  ImportMode,
  ImportResult,
  MediaFile,
  ScanConfig,
  ScanProgress,
  SearchQuery,
  TagInfo,
} from "./types";

export async function searchFiles(query: SearchQuery): Promise<MediaFile[]> {
  return invoke("search_files", { query });
}

export async function getFile(hash: string): Promise<MediaFile | null> {
  return invoke("get_file", { hash });
}

export async function addTag(hash: string, tag: string): Promise<void> {
  return invoke("add_tag", { hash, tag });
}

export async function removeTag(hash: string, tag: string): Promise<void> {
  return invoke("remove_tag", { hash, tag });
}

export async function batchAddTags(op: BatchTagOp): Promise<void> {
  return invoke("batch_add_tags", { op });
}

export async function batchRemoveTags(op: BatchTagOp): Promise<void> {
  return invoke("batch_remove_tags", { op });
}

export async function listTags(): Promise<TagInfo[]> {
  return invoke("list_tags");
}

export async function suggestTags(prefix: string): Promise<string[]> {
  return invoke("suggest_tags", { prefix });
}

export async function renameTag(oldName: string, newName: string): Promise<void> {
  return invoke("rename_tag", { oldName, newName });
}

export async function deleteTagGlobal(tagName: string): Promise<void> {
  return invoke("delete_tag_global", { tagName });
}

export async function batchDeleteTags(tagNames: string[]): Promise<number> {
  return invoke("batch_delete_tags", { tagNames });
}

export async function reconcileFiles(): Promise<number> {
  return invoke("reconcile_files");
}

export async function startScan(config: ScanConfig): Promise<number> {
  return invoke("start_scan", { config });
}

export async function pauseScan(): Promise<void> {
  return invoke("pause_scan");
}

export async function resumeScan(): Promise<void> {
  return invoke("resume_scan");
}

export async function cancelScan(): Promise<void> {
  return invoke("cancel_scan");
}

export function onScanProgress(
  callback: (progress: ScanProgress) => void
): Promise<UnlistenFn> {
  return listen<ScanProgress>("scan-progress", (event) => {
    callback(event.payload);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleString("zh-CN");
}

/** 将本地文件路径转为 WebView 可加载的 asset URL */
export function toAssetUrl(path: string): string {
  return convertFileSrc(path);
}

export function isPreviewable(file: { file_type: string; status: number }): boolean {
  return file.status === 1 && (file.file_type === "image" || file.file_type === "video");
}

export async function exportTags(path: string): Promise<ExportSummary> {
  return invoke("export_tags", { path });
}

export async function importTags(path: string, mode: ImportMode): Promise<ImportResult> {
  return invoke("import_tags", { path, mode });
}
