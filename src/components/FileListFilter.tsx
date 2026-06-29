import { useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import type {
  FileTypeFilter,
  StatusFilter,
  TagInfo,
  TagPresenceFilter,
} from "../types";

interface FileListFilterProps {
  tags: TagInfo[];
  fileTypeFilter: FileTypeFilter;
  statusFilter: StatusFilter;
  tagPresenceFilter: TagPresenceFilter;
  selectedTags: string[];
  onFileTypeChange: (value: FileTypeFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
  onTagPresenceChange: (value: TagPresenceFilter) => void;
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
}

const FILE_TYPE_LABELS: Record<FileTypeFilter, string> = {
  all: "全部",
  image: "图片",
  video: "视频",
  audio: "音频",
  other: "其他",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "全部",
  active: "正常",
  lost: "丢失",
};

const TAG_PRESENCE_LABELS: Record<TagPresenceFilter, string> = {
  all: "全部",
  tagged: "有标签",
  untagged: "无标签",
};

function FilterGroup<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-fg-muted shrink-0">{label}</span>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2 py-0.5 rounded text-xs transition-colors ${
            value === opt
              ? "bg-accent/25 text-accent"
              : "bg-input/60 text-fg-subtle hover:bg-hover-strong"
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export default function FileListFilter({
  tags,
  fileTypeFilter,
  statusFilter,
  tagPresenceFilter,
  selectedTags,
  onFileTypeChange,
  onStatusChange,
  onTagPresenceChange,
  onToggleTag,
  onClearFilters,
}: FileListFilterProps) {
  const [tagSearch, setTagSearch] = useState("");

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, tagSearch]);

  const hasActiveFilters =
    fileTypeFilter !== "all" ||
    statusFilter !== "all" ||
    tagPresenceFilter !== "all" ||
    selectedTags.length > 0;

  return (
    <div className="border-b border-border bg-surface-sunken/40 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <Filter className="w-3.5 h-3.5" />
          筛选
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 text-xs text-fg-muted hover:text-accent transition-colors"
          >
            <X className="w-3 h-3" />
            清除筛选
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <FilterGroup
          label="类型"
          value={fileTypeFilter}
          options={["all", "image", "video", "audio", "other"]}
          labels={FILE_TYPE_LABELS}
          onChange={onFileTypeChange}
        />
        <FilterGroup
          label="状态"
          value={statusFilter}
          options={["all", "active", "lost"]}
          labels={STATUS_LABELS}
          onChange={onStatusChange}
        />
        <FilterGroup
          label="标签"
          value={tagPresenceFilter}
          options={["all", "tagged", "untagged"]}
          labels={TAG_PRESENCE_LABELS}
          onChange={onTagPresenceChange}
        />
      </div>

      {tags.length > 0 && (
        <div className="space-y-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-muted" />
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="按标签筛选..."
              className="w-full pl-7 pr-3 py-1.5 rounded-md bg-input/60 border border-border-strong/80 text-xs focus:outline-none focus:border-accent/50"
            />
          </div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {filteredTags.length === 0 ? (
              <span className="text-xs text-fg-muted py-1">未找到匹配标签</span>
            ) : (
              filteredTags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onToggleTag(t.name)}
                  className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                    selectedTags.includes(t.name)
                      ? "bg-accent/30 text-accent ring-1 ring-accent/40"
                      : "bg-elevated text-fg-subtle hover:bg-hover-strong"
                  }`}
                  title={`${t.count} 个文件`}
                >
                  {t.name}
                </button>
              ))
            )}
          </div>
          {selectedTags.length > 0 && (
            <div className="text-xs text-fg-muted">
              已选 {selectedTags.length} 个标签
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function hasActiveFileFilters(
  fileTypeFilter: FileTypeFilter,
  statusFilter: StatusFilter,
  tagPresenceFilter: TagPresenceFilter,
  selectedTags: string[]
): boolean {
  return (
    fileTypeFilter !== "all" ||
    statusFilter !== "all" ||
    tagPresenceFilter !== "all" ||
    selectedTags.length > 0
  );
}
