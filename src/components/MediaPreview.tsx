import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { MediaFile } from "../types";
import { toAssetUrl } from "../api";

interface MediaPreviewProps {
  file: MediaFile;
}

export default function MediaPreview({ file }: MediaPreviewProps) {
  const [failed, setFailed] = useState(false);

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
      <div className="mx-4 mt-4 rounded-lg overflow-hidden bg-surface-sunken/80 border border-border-strong/50">
        <img
          src={toAssetUrl(file.path)}
          alt={file.filename}
          className="w-full max-h-56 object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  if (file.file_type === "video") {
    return (
      <div className="mx-4 mt-4 rounded-lg overflow-hidden bg-video border border-border-strong/50">
        <video
          src={toAssetUrl(file.path)}
          controls
          preload="metadata"
          className="w-full max-h-56"
        />
      </div>
    );
  }

  return null;
}
