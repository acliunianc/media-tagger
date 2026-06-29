import { useCallback, useEffect, useRef, useState } from "react";
import { FixedSizeList as List } from "react-window";
import { File, AlertCircle } from "lucide-react";
import type { MediaFile } from "../types";
import { formatFileSize } from "../api";
import MediaThumbnail from "./MediaThumbnail";

interface FileListProps {
  files: MediaFile[];
  selectedHashes: Set<string>;
  activeHash: string | null;
  onSelect: (hash: string, ctrl: boolean, shift: boolean) => void;
  onDoubleClick: (hash: string) => void;
  filtered?: boolean;
  /** 布局变化时触发列表高度重算（如筛选面板展开/收起） */
  layoutKey?: string;
}

const ROW_HEIGHT = 56;

export default function FileList({
  files,
  selectedHashes,
  activeHash,
  onSelect,
  onDoubleClick,
  filtered = false,
  layoutKey,
}: FileListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const lastClickedRef = useRef<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateHeight = () => {
      setHeight(Math.floor(el.getBoundingClientRect().height));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layoutKey, files.length]);

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const file = files[index];
      const isSelected = selectedHashes.has(file.hash);
      const isActive = activeHash === file.hash;
      const isLost = file.status === 0;

      return (
        <div
          style={style}
          className={`flex items-center gap-3 px-3 box-border cursor-pointer border-b border-slate-800/50 transition-colors
            ${isSelected ? "bg-accent/20" : "hover:bg-slate-800/40"}
            ${isActive ? "ring-1 ring-inset ring-accent/50" : ""}
            ${isLost ? "opacity-60" : ""}`}
          onClick={(e) => {
            onSelect(file.hash, e.ctrlKey || e.metaKey, e.shiftKey);
            lastClickedRef.current = file.hash;
          }}
          onDoubleClick={() => onDoubleClick(file.hash)}
        >
          <MediaThumbnail file={file} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm truncate">{file.filename}</span>
              {isLost && (
                <span className="flex items-center gap-1 text-xs text-amber-400 shrink-0">
                  <AlertCircle className="w-3 h-3" />
                  丢失
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{formatFileSize(file.size)}</span>
              {file.tags.length > 0 && (
                <span className="truncate">
                  {file.tags.slice(0, 3).join(", ")}
                  {file.tags.length > 3 && ` +${file.tags.length - 3}`}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    },
    [files, selectedHashes, activeHash, onSelect, onDoubleClick]
  );

  if (files.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-slate-500">
        <div className="text-center">
          <File className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{filtered ? "没有匹配的文件" : "暂无文件"}</p>
          <p className="text-sm mt-1">
            {filtered ? "尝试调整筛选条件" : "点击「扫描文件夹」开始"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
      {height > 0 && (
        <List height={height} itemCount={files.length} itemSize={ROW_HEIGHT} width="100%">
          {Row}
        </List>
      )}
    </div>
  );
}
