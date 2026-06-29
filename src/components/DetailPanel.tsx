import { useEffect, useRef, useState } from "react";
import { X, Tag, Hash, Clock, HardDrive, FolderOpen } from "lucide-react";
import type { MediaFile } from "../types";
import { addTag, formatDate, formatFileSize, isPreviewable, removeTag, suggestTags } from "../api";
import MediaPreview from "./MediaPreview";

interface DetailPanelProps {
  file: MediaFile | null;
  onTagsChanged: () => void;
}

export default function DetailPanel({ file, onTagsChanged }: DetailPanelProps) {
  const [newTag, setNewTag] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNewTag("");
    setSuggestions([]);
  }, [file?.hash]);

  useEffect(() => {
    if (!newTag.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await suggestTags(newTag.trim());
      setSuggestions(results.filter((t) => !file?.tags.includes(t)));
    }, 200);
    return () => clearTimeout(timer);
  }, [newTag, file?.tags]);

  if (!file) {
    return (
      <div className="w-96 border-l border-slate-800 flex items-center justify-center text-slate-500">
        <p className="text-sm">选择文件查看详情</p>
      </div>
    );
  }

  const handleAddTag = async (tag: string) => {
    if (!tag.trim()) return;
    await addTag(file.hash, tag.trim());
    setNewTag("");
    setShowSuggestions(false);
    onTagsChanged();
  };

  const handleRemoveTag = async (tag: string) => {
    await removeTag(file.hash, tag);
    onTagsChanged();
  };

  return (
    <div className="w-96 border-l border-slate-800 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h3 className="font-medium truncate" title={file.filename}>
          {file.filename}
        </h3>
        {file.status === 0 && (
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
            文件已丢失
          </span>
        )}
      </div>

      {isPreviewable(file) && <MediaPreview file={file} />}

      <div className="p-4 space-y-3 text-sm border-b border-slate-800">
        <MetaRow icon={<HardDrive className="w-4 h-4" />} label="大小" value={formatFileSize(file.size)} />
        <MetaRow icon={<FolderOpen className="w-4 h-4" />} label="路径" value={file.path} truncate />
        <MetaRow icon={<Clock className="w-4 h-4" />} label="修改时间" value={formatDate(file.modified_time)} />
        <MetaRow icon={<Hash className="w-4 h-4" />} label="哈希" value={file.hash.slice(0, 16) + "..."} title={file.hash} />
        <MetaRow icon={<Tag className="w-4 h-4" />} label="类型" value={file.file_type} />
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">标签</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          {file.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/20 text-accent text-xs"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-accent-hover transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {file.tags.length === 0 && (
            <span className="text-xs text-slate-500">暂无标签</span>
          )}
        </div>

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={newTag}
            onChange={(e) => {
              setNewTag(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTag(newTag);
            }}
            placeholder="添加标签..."
            className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-accent/50"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors"
                  onMouseDown={() => handleAddTag(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
  truncate,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  truncate?: boolean;
  title?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-500 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div
          className={`text-slate-300 ${truncate ? "truncate" : ""}`}
          title={title || value}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
