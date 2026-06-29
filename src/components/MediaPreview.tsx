import { useState } from "react";
import { Eye, ImageOff, Maximize2 } from "lucide-react";
import type { MediaFile } from "../types";
import { toAssetUrl } from "../api";
import MediaFullscreenViewer from "./MediaFullscreenViewer";

interface MediaPreviewProps {
  file: MediaFile;
}

export default function MediaPreview({ file }: MediaPreviewProps) {
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  if (file.status === 0) {
    return (
      <div className="mx-4 mt-4 p-6 rounded-lg bg-hover/40 border border-border-strong flex flex-col items-center gap-2 text-fg-muted">
        <ImageOff className="w-8 h-8" />
        <span className="text-xs">文件已丢失，无法预览</span>
      </div>
    );
  }

  if (file.file_type === "image") {
    if (failed) {
      return (
        <div className="mx-4 mt-4 p-6 rounded-lg bg-hover/40 border border-border-strong flex flex-col items-center gap-2 text-fg-muted">
          <ImageOff className="w-8 h-8" />
          <span className="text-xs">无法加载图片预览</span>
        </div>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="mx-4 mt-4 block w-[calc(100%-2rem)] rounded-lg overflow-hidden border border-border-strong/50 cursor-pointer group text-left"
          title="点击预览"
        >
          <div className="relative flex items-center justify-center min-h-[140px] bg-surface-sunken/80">
            <img
              src={toAssetUrl(file.path)}
              alt={file.filename}
              className="max-w-full max-h-56 object-contain pointer-events-none"
              onError={() => setFailed(true)}
              draggable={false}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/45 transition-colors duration-200">
              <Eye className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
          </div>
        </button>
        <MediaFullscreenViewer
          file={file}
          open={fullscreen}
          onClose={() => setFullscreen(false)}
        />
      </>
    );
  }

  if (file.file_type === "video") {
    return (
      <>
        <div className="mx-4 mt-4 rounded-lg overflow-hidden bg-video border border-border-strong/50 relative">
          <video
            src={toAssetUrl(file.path)}
            controls
            preload="metadata"
            className="w-full max-h-56"
          />
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-elevated/90 text-xs text-fg hover:bg-hover transition-colors shadow-sm"
            title="全屏播放"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            全屏
          </button>
        </div>
        <MediaFullscreenViewer
          file={file}
          open={fullscreen}
          onClose={() => setFullscreen(false)}
        />
      </>
    );
  }

  return null;
}
