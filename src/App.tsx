import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  FolderSearch,
  Tag,
  RefreshCw,
  Pause,
  Play,
  XCircle,
  ArrowDownUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import FileList from "./components/FileList";
import FileListFilter, { hasActiveFileFilters } from "./components/FileListFilter";
import FolderTree from "./components/FolderTree";
import DetailPanel from "./components/DetailPanel";
import ScanDialog from "./components/ScanDialog";
import TagManager from "./components/TagManager";
import ImportExportDialog from "./components/ImportExportDialog";
import {
  searchFiles,
  startScan,
  pauseScan,
  resumeScan,
  cancelScan,
  onScanProgress,
  reconcileFiles,
  listTags,
  listFolderTree,
  batchAddTags,
  batchRemoveTags,
} from "./api";
import type { MediaFile, ScanProgress, TagInfo, FolderNode, FileTypeFilter, StatusFilter, TagPresenceFilter } from "./types";

export default function App() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [activeHash, setActiveHash] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagLogic, setTagLogic] = useState<"AND" | "OR">("AND");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tagPresenceFilter, setTagPresenceFilter] = useState<TagPresenceFilter>("all");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderRoots, setFolderRoots] = useState<FolderNode[]>([]);
  const [totalFileCount, setTotalFileCount] = useState(0);
  const [showListFilters, setShowListFilters] = useState(true);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [batchTagInput, setBatchTagInput] = useState("");
  const lastSelectedRef = useRef<string | null>(null);

  const activeFile = files.find((f) => f.hash === activeHash) ?? null;

  const selectedFileTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const file of files) {
      if (selectedHashes.has(file.hash)) {
        file.tags.forEach((tag) => tagSet.add(tag));
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [files, selectedHashes]);

  const loadFiles = useCallback(async () => {
    const fileTypes =
      fileTypeFilter === "all" ? [] : [fileTypeFilter];
    const status =
      statusFilter === "all" ? undefined : statusFilter === "active" ? 1 : 0;
    const hasTags =
      tagPresenceFilter === "all"
        ? undefined
        : tagPresenceFilter === "tagged";

    const results = await searchFiles({
      query: searchQuery,
      logic: tagLogic,
      tags: selectedTags,
      file_types: fileTypes,
      status,
      has_tags: hasTags,
      folder_path: selectedFolder ?? undefined,
    });
    setFiles(results);
  }, [searchQuery, tagLogic, selectedTags, fileTypeFilter, statusFilter, tagPresenceFilter, selectedFolder]);

  const loadTags = useCallback(async () => {
    const t = await listTags();
    setTags(t);
  }, []);

  const loadFolderTree = useCallback(async () => {
    const tree = await listFolderTree();
    setFolderRoots(tree.roots);
    setTotalFileCount(tree.total_files);
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    loadTags();
    loadFolderTree();
  }, [loadTags, loadFolderTree]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onScanProgress((progress) => {
      setScanProgress(progress);
      if (progress.status === "done" || progress.status === "cancelled") {
        setScanning(false);
        setScanPaused(false);
        loadFiles();
        loadTags();
        loadFolderTree();
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [loadFiles, loadTags, loadFolderTree]);

  const handleSelect = useCallback(
    (hash: string, ctrl: boolean, shift: boolean) => {
      setActiveHash(hash);

      if (shift && lastSelectedRef.current) {
        const startIdx = files.findIndex((f) => f.hash === lastSelectedRef.current);
        const endIdx = files.findIndex((f) => f.hash === hash);
        if (startIdx >= 0 && endIdx >= 0) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const range = files.slice(from, to + 1).map((f) => f.hash);
          setSelectedHashes(new Set(range));
          return;
        }
      }

      if (ctrl) {
        setSelectedHashes((prev) => {
          const next = new Set(prev);
          if (next.has(hash)) next.delete(hash);
          else next.add(hash);
          return next;
        });
      } else {
        setSelectedHashes(new Set([hash]));
      }
      lastSelectedRef.current = hash;
    },
    [files]
  );

  const handleScan = async (paths: string[], excludePatterns: string[]) => {
    setScanning(true);
    setScanPaused(false);
    setShowScanDialog(false);
    try {
      await startScan({ paths, exclude_patterns: excludePatterns });
    } catch (e) {
      console.error("Scan failed:", e);
      setScanning(false);
    }
  };

  const handleReconcile = async () => {
    const count = await reconcileFiles();
    loadFolderTree();
    if (count > 0) {
      loadFiles();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (selectedHashes.size === 0) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleBatchAddTag = async () => {
    if (!batchTagInput.trim() || selectedHashes.size === 0) return;
    await batchAddTags({
      hashes: Array.from(selectedHashes),
      tags: [batchTagInput.trim()],
    });
    setBatchTagInput("");
    setContextMenu(null);
    loadFiles();
    loadTags();
  };

  const handleBatchRemoveTag = async (tag: string) => {
    await batchRemoveTags({
      hashes: Array.from(selectedHashes),
      tags: [tag],
    });
    setContextMenu(null);
    loadFiles();
    loadTags();
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearListFilters = () => {
    setFileTypeFilter("all");
    setStatusFilter("all");
    setTagPresenceFilter("all");
    setSelectedTags([]);
  };

  const listFiltersActive = hasActiveFileFilters(
    fileTypeFilter,
    statusFilter,
    tagPresenceFilter,
    selectedTags
  );

  return (
    <div className="h-screen flex flex-col bg-page">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/80 backdrop-blur">
        <h1 className="text-lg font-bold text-accent mr-2">MediaTagger</h1>

        <div className="flex-1 flex items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文件名、路径或标签..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-input/60 border border-border-strong text-sm focus:outline-none focus:border-accent/50"
            />
          </div>
          <select
            value={tagLogic}
            onChange={(e) => setTagLogic(e.target.value as "AND" | "OR")}
            className="px-2 py-2 rounded-lg bg-input/60 border border-border-strong text-sm focus:outline-none"
            title="标签搜索逻辑"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>

        <button
          onClick={() => setShowScanDialog(true)}
          disabled={scanning}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-sm transition-colors disabled:opacity-50"
        >
          <FolderSearch className="w-4 h-4" />
          扫描
        </button>

        <button
          onClick={handleReconcile}
          className="p-2 rounded-lg hover:bg-hover transition-colors"
          title="同步文件状态"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowTagManager(true)}
          className="p-2 rounded-lg hover:bg-hover transition-colors"
          title="标签管理"
        >
          <Tag className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowImportExport(true)}
          className="p-2 rounded-lg hover:bg-hover transition-colors"
          title="导入 / 导出"
        >
          <ArrowDownUp className="w-5 h-5" />
        </button>
      </header>

      {/* Scan progress */}
      {scanning && scanProgress && (
        <div className="flex items-center gap-4 px-4 py-2 bg-surface-light border-b border-border text-sm">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span>
                {scanProgress.status === "paused"
                  ? "已暂停"
                  : `扫描中 ${scanProgress.scanned}/${scanProgress.total}`}
              </span>
              <span className="text-fg-muted truncate max-w-md">
                {scanProgress.current_path}
              </span>
            </div>
            <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{
                  width: `${
                    scanProgress.total > 0
                      ? (scanProgress.scanned / scanProgress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
          {scanPaused ? (
            <button
              onClick={() => {
                resumeScan();
                setScanPaused(false);
              }}
              className="p-1.5 rounded hover:bg-hover"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                pauseScan();
                setScanPaused(true);
              }}
              className="p-1.5 rounded hover:bg-hover"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              cancelScan();
              setScanning(false);
            }}
            className="p-1.5 rounded hover:bg-hover text-danger"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden" onContextMenu={handleContextMenu}>
        <FolderTree
          roots={folderRoots}
          totalFiles={totalFileCount}
          selectedFolder={selectedFolder}
          onSelectFolder={setSelectedFolder}
        />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-fg-muted border-b border-border">
            <span className="truncate min-w-0">
              {files.length} 个文件
              {selectedHashes.size > 0 && ` · 已选 ${selectedHashes.size}`}
              {listFiltersActive && " · 已筛选"}
              {selectedFolder && (
                <span className="text-fg-subtle">
                  {" "}
                  ·{" "}
                  <span title={selectedFolder}>
                    {selectedFolder.split(/[/\\]/).pop()}
                  </span>
                </span>
              )}
            </span>
            <button
              onClick={() => setShowListFilters(!showListFilters)}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                showListFilters || listFiltersActive
                  ? "text-accent bg-accent/10"
                  : "hover:bg-hover text-fg-subtle"
              }`}
            >
              筛选
              {showListFilters ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          {showListFilters && (
            <FileListFilter
              tags={tags}
              fileTypeFilter={fileTypeFilter}
              statusFilter={statusFilter}
              tagPresenceFilter={tagPresenceFilter}
              selectedTags={selectedTags}
              onFileTypeChange={setFileTypeFilter}
              onStatusChange={setStatusFilter}
              onTagPresenceChange={setTagPresenceFilter}
              onToggleTag={toggleTagFilter}
              onClearFilters={clearListFilters}
            />
          )}
          <FileList
            files={files}
            selectedHashes={selectedHashes}
            activeHash={activeHash}
            onSelect={handleSelect}
            onDoubleClick={setActiveHash}
            filtered={listFiltersActive || searchQuery.trim().length > 0}
            layoutKey={`${showListFilters ? "open" : "closed"}-${selectedFolder ?? "all"}`}
          />
        </div>
        <DetailPanel
          file={activeFile}
          onTagsChanged={() => {
            loadFiles();
            loadTags();
          }}
        />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-elevated border border-border-strong rounded-lg shadow-xl py-2 min-w-[200px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1 text-xs text-fg-muted">
              批量操作 ({selectedHashes.size} 文件)
            </div>
            <div className="px-3 py-2 flex gap-2">
              <input
                type="text"
                value={batchTagInput}
                onChange={(e) => setBatchTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBatchAddTag()}
                placeholder="添加标签..."
                className="flex-1 px-2 py-1 rounded bg-surface-sunken border border-border-input text-sm focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleBatchAddTag}
                className="px-2 py-1 rounded bg-accent text-xs hover:bg-accent-hover"
              >
                添加
              </button>
            </div>
            {selectedFileTags.length > 0 ? (
              <div className="border-t border-border-strong mt-1 pt-1 max-h-40 overflow-y-auto">
                {selectedFileTags.map((name) => (
                  <button
                    key={name}
                    onClick={() => handleBatchRemoveTag(name)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-hover-strong transition-colors"
                  >
                    移除「{name}」
                  </button>
                ))}
              </div>
            ) : (
              <div className="border-t border-border-strong mt-1 px-3 py-2 text-xs text-fg-muted">
                选中文件暂无标签可移除
              </div>
            )}
          </div>
        </>
      )}

      <ScanDialog
        open={showScanDialog}
        onClose={() => setShowScanDialog(false)}
        onScan={handleScan}
        scanning={scanning}
      />

      <TagManager
        open={showTagManager}
        tags={tags}
        onClose={() => setShowTagManager(false)}
        onChanged={() => {
          loadTags();
          loadFiles();
        }}
      />

      <ImportExportDialog
        open={showImportExport}
        onClose={() => setShowImportExport(false)}
        onCompleted={(message) => {
          setToast(message);
          loadTags();
          loadFiles();
          loadFolderTree();
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-elevated border border-border-input shadow-xl text-sm max-w-md text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
