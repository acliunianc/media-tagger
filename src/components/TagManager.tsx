import { useState } from "react";
import { Tag, Edit2, Trash2, X } from "lucide-react";
import type { TagInfo } from "../types";
import { deleteTagGlobal, renameTag } from "../api";

interface TagManagerProps {
  open: boolean;
  tags: TagInfo[];
  onClose: () => void;
  onChanged: () => void;
}

export default function TagManager({ open: isOpen, tags, onClose, onChanged }: TagManagerProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

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
    if (confirm(`确定删除标签「${name}」？所有关联文件的该标签将被移除。`)) {
      await deleteTagGlobal(name);
      onChanged();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-light rounded-xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5" />
            全局标签管理
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {tags.length === 0 ? (
            <p className="text-center text-slate-500 py-8">暂无标签</p>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/40 group"
              >
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
                    <span className="flex-1 text-sm">{tag.name}</span>
                    <span className="text-xs text-slate-500">{tag.count} 文件</span>
                    <button
                      onClick={() => {
                        setEditingId(tag.id);
                        setEditName(tag.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tag.name)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
