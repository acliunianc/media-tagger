import { useEffect, useMemo, useState } from "react";
import { Tag, Edit2, Trash2, X, Search } from "lucide-react";
import type { TagInfo } from "../types";
import { batchDeleteTags, deleteTagGlobal, renameTag } from "../api";

interface TagManagerProps {
  open: boolean;
  tags: TagInfo[];
  onClose: () => void;
  onChanged: () => void;
}

export default function TagManager({ open: isOpen, tags, onClose, onChanged }: TagManagerProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setSelected(new Set());
      setEditingId(null);
    }
  }, [isOpen]);

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  const allFilteredSelected =
    filteredTags.length > 0 && filteredTags.every((t) => selected.has(t.id));

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredTags.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredTags.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const handleRename = async (oldName: string) => {
    if (!editName.trim() || editName === oldName) {
      setEditingId(null);
      return;
    }
    await renameTag(oldName, editName.trim());
    setEditingId(null);
    onChanged();
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除标签「${name}」？所有关联文件的该标签将被移除。`)) return;
    setBusy(true);
    try {
      await deleteTagGlobal(name);
      setSelected((prev) => {
        const tag = tags.find((t) => t.name === name);
        if (!tag) return prev;
        const next = new Set(prev);
        next.delete(tag.id);
        return next;
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleBatchDelete = async () => {
    const names = tags.filter((t) => selected.has(t.id)).map((t) => t.name);
    if (names.length === 0) return;
    if (
      !confirm(
        `确定删除选中的 ${names.length} 个标签？所有关联文件的对应标签将被移除。`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await batchDeleteTags(names);
      setSelected(new Set());
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-light rounded-xl shadow-2xl w-[520px] max-h-[75vh] flex flex-col border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5" />
            全局标签管理
            <span className="text-xs font-normal text-slate-500">({tags.length})</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-700 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标签..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-accent/50"
            />
          </div>

          {tags.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  disabled={filteredTags.length === 0 || busy}
                  className="rounded"
                />
                全选{search.trim() ? "当前结果" : ""}
              </label>
              {selected.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除选中 ({selected.size})
                </button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {tags.length === 0 ? (
            <p className="text-center text-slate-500 py-8">暂无标签</p>
          ) : filteredTags.length === 0 ? (
            <p className="text-center text-slate-500 py-8">未找到匹配的标签</p>
          ) : (
            filteredTags.map((tag) => (
              <div
                key={tag.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/40 ${
                  selected.has(tag.id) ? "bg-accent/10" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(tag.id)}
                  onChange={() => toggleSelect(tag.id)}
                  disabled={busy || editingId === tag.id}
                  className="shrink-0 rounded"
                />

                {editingId === tag.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(tag.name);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => handleRename(tag.name)}
                    className="flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-sm focus:outline-none"
                  />
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate" title={tag.name}>
                      {tag.name}
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {tag.count} 文件
                    </span>
                    <button
                      onClick={() => {
                        setEditingId(tag.id);
                        setEditName(tag.name);
                      }}
                      disabled={busy}
                      title="重命名"
                      className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tag.name)}
                      disabled={busy}
                      title="删除"
                      className="p-1 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {search.trim() && filteredTags.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500">
            显示 {filteredTags.length} / {tags.length} 个标签
          </div>
        )}
      </div>
    </div>
  );
}
