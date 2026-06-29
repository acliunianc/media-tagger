import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, X, Plus } from "lucide-react";

interface ScanDialogProps {
  open: boolean;
  onClose: () => void;
  onScan: (paths: string[], excludePatterns: string[]) => void;
  scanning: boolean;
}

export default function ScanDialog({ open: isOpen, onClose, onScan, scanning }: ScanDialogProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [excludeInput, setExcludeInput] = useState("*.tmp\nnode_modules/\n.git/");
  const [newExclude, setNewExclude] = useState("");

  const handlePickFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: true,
      title: "选择要扫描的文件夹",
    });
    if (selected) {
      const newPaths = Array.isArray(selected) ? selected : [selected];
      setPaths((prev) => [...new Set([...prev, ...newPaths])]);
    }
  };

  const handleRemovePath = (path: string) => {
    setPaths((prev) => prev.filter((p) => p !== path));
  };

  const handleAddExclude = () => {
    if (newExclude.trim()) {
      setExcludeInput((prev) => prev + (prev.endsWith("\n") ? "" : "\n") + newExclude.trim());
      setNewExclude("");
    }
  };

  const handleStart = () => {
    const patterns = excludeInput
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    onScan(paths, patterns);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-light rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold">扫描配置</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">扫描目录</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {paths.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 text-sm"
                >
                  <FolderOpen className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 truncate" title={p}>
                    {p}
                  </span>
                  <button
                    onClick={() => handleRemovePath(p)}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {paths.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">尚未选择目录</p>
              )}
            </div>
            <button
              onClick={handlePickFolder}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              选择文件夹
            </button>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">排除规则（每行一条，支持通配符）</label>
            <textarea
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm font-mono focus:outline-none focus:border-accent/50 resize-none"
              placeholder="*.tmp&#10;node_modules/"
            />
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newExclude}
                onChange={(e) => setNewExclude(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddExclude()}
                placeholder="添加排除规则..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-accent/50"
              />
              <button
                onClick={handleAddExclude}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleStart}
            disabled={paths.length === 0 || scanning}
            className="px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scanning ? "扫描中..." : "开始扫描"}
          </button>
        </div>
      </div>
    </div>
  );
}
