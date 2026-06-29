import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Download, Upload, X } from "lucide-react";
import { exportTags, importTags } from "../api";
import type { ImportMode } from "../types";

interface ImportExportDialogProps {
  open: boolean;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

function formatExportMessage(result: {
  entry_count: number;
  tag_count: number;
  empty_tag_count: number;
}) {
  if (result.tag_count === 0) {
    return "导出成功：暂无标签数据";
  }
  if (result.entry_count === 0) {
    return `导出成功：${result.tag_count} 个标签（均为空标签）`;
  }
  const emptyPart =
    result.empty_tag_count > 0 ? `，含 ${result.empty_tag_count} 个空标签` : "";
  return `导出成功：${result.entry_count} 个文件，${result.tag_count} 个标签${emptyPart}`;
}

function formatImportMessage(
  modeLabel: string,
  result: {
    imported_entries: number;
    imported_tags: number;
    imported_empty_tags: number;
  }
) {
  const totalTags = result.imported_tags + result.imported_empty_tags;
  if (totalTags === 0 && result.imported_entries === 0) {
    return `${modeLabel}导入成功：暂无数据`;
  }
  if (result.imported_entries === 0) {
    return `${modeLabel}导入成功：${totalTags} 个标签（${result.imported_empty_tags} 个空标签）`;
  }
  const emptyPart =
    result.imported_empty_tags > 0
      ? `，${result.imported_empty_tags} 个空标签`
      : "";
  return `${modeLabel}导入成功：${result.imported_entries} 个文件，${result.imported_tags} 条标签关联${emptyPart}`;
}

export default function ImportExportDialog({
  open: isOpen,
  onClose,
  onCompleted,
}: ImportExportDialogProps) {
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    const path = await save({
      title: "导出标签数据",
      defaultPath: `mediatagger-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;

    setBusy(true);
    try {
      const result = await exportTags(path);
      onCompleted(formatExportMessage(result));
      onClose();
    } catch (e) {
      onCompleted(`导出失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    const path = await open({
      title: "导入标签数据",
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path || typeof path !== "string") return;

    const modeLabel = importMode === "merge" ? "合并" : "替换";
    if (
      importMode === "replace" &&
      !confirm(
        "替换模式将清除当前所有标签数据，并用导入文件中的标签完全覆盖。确定继续？"
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const result = await importTags(path, importMode);
      onCompleted(formatImportMessage(modeLabel, result));
      onClose();
    } catch (e) {
      onCompleted(`导入失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60">
      <div className="bg-surface-light rounded-xl shadow-2xl w-[480px] border border-border-strong">
        <div className="flex items-center justify-between p-4 border-b border-border-strong">
          <h2 className="text-lg font-semibold">导入 / 导出</h2>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <section>
            <h3 className="text-sm font-medium text-fg-secondary mb-2">导出</h3>
            <p className="text-xs text-fg-muted mb-3">
              仅导出有标签的文件及全部标签定义（含无文件关联的空标签）。
            </p>
            <button
              onClick={handleExport}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated hover:bg-hover-strong text-sm transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              导出标签数据
            </button>
          </section>

          <div className="border-t border-border-strong" />

          <section>
            <h3 className="text-sm font-medium text-fg-secondary mb-2">导入</h3>
            <p className="text-xs text-fg-muted mb-3">
              从 JSON 导入标签与文件关联；空标签也会一并恢复。标签通过内容哈希匹配。
            </p>

            <div className="space-y-2 mb-4">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border-strong cursor-pointer hover:bg-hover/40">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === "merge"}
                  onChange={() => setImportMode("merge")}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">合并</div>
                  <div className="text-xs text-fg-muted">
                    保留现有标签，追加导入文件中的新标签（相同哈希去重）
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border-strong cursor-pointer hover:bg-hover/40">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">替换</div>
                  <div className="text-xs text-fg-muted">
                    清除所有现有标签，完全使用导入文件中的标签数据
                  </div>
                </div>
              </label>
            </div>

            <button
              onClick={handleImport}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-sm transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              选择文件并导入
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
