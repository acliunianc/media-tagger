import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  HardDrive,
} from "lucide-react";
import type { FolderNode } from "../types";

interface FolderTreeProps {
  roots: FolderNode[];
  totalFiles: number;
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
}

interface FolderTreeNodeProps {
  node: FolderNode;
  depth: number;
  selectedFolder: string | null;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFolder: (path: string) => void;
}

function FolderTreeNode({
  node,
  depth,
  selectedFolder,
  expandedPaths,
  onToggleExpand,
  onSelectFolder,
}: FolderTreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedFolder === node.path;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 pr-2 rounded-md cursor-pointer text-sm transition-colors ${
          isSelected
            ? "bg-accent/20 text-accent"
            : "text-fg-secondary hover:bg-input/60"
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelectFolder(node.path)}
        title={node.path}
      >
        <button
          type="button"
          className="p-0.5 shrink-0 text-fg-muted hover:text-fg-secondary"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(node.path);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="w-3.5 h-3.5 inline-block" />
          )}
        </button>
        {isSelected ? (
          <FolderOpen className="w-4 h-4 shrink-0 text-accent" />
        ) : (
          <Folder className="w-4 h-4 shrink-0 text-fg-muted" />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        <span className="text-xs text-fg-muted shrink-0">{node.file_count}</span>
      </div>
      {hasChildren && isExpanded &&
        node.children.map((child) => (
          <FolderTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedFolder={selectedFolder}
            expandedPaths={expandedPaths}
            onToggleExpand={onToggleExpand}
            onSelectFolder={onSelectFolder}
          />
        ))}
    </div>
  );
}

export default function FolderTree({
  roots,
  totalFiles,
  selectedFolder,
  onSelectFolder,
}: FolderTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const defaultExpanded = useMemo(() => {
    const paths = new Set<string>();
    for (const root of roots) {
      paths.add(root.path);
    }
    return paths;
  }, [roots]);

  const effectiveExpanded =
    expandedPaths.size > 0 ? expandedPaths : defaultExpanded;

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const base = prev.size > 0 ? prev : new Set(defaultExpanded);
      const next = new Set(base);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="w-56 shrink-0 flex flex-col min-h-0 border-r border-border bg-surface-sunken/30">
      <div className="px-3 py-2 text-xs font-medium text-fg-subtle border-b border-border">
        文件夹
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-1">
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors mb-1 ${
            selectedFolder === null
              ? "bg-accent/20 text-accent"
              : "text-fg-secondary hover:bg-input/60"
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <HardDrive className="w-4 h-4 shrink-0" />
          <span className="flex-1">全部文件</span>
          <span className="text-xs text-fg-muted">{totalFiles}</span>
        </div>

        {roots.length === 0 ? (
          <p className="px-2 py-4 text-xs text-fg-muted text-center">扫描后显示目录</p>
        ) : (
          roots.map((root) => (
            <FolderTreeNode
              key={root.path}
              node={root}
              depth={0}
              selectedFolder={selectedFolder}
              expandedPaths={effectiveExpanded}
              onToggleExpand={toggleExpand}
              onSelectFolder={onSelectFolder}
            />
          ))
        )}
      </div>
    </div>
  );
}
