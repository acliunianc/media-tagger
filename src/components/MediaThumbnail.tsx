import { useState } from "react";
import { FileAudio, FileImage, FileVideo, File } from "lucide-react";
import type { MediaFile } from "../types";
import { toAssetUrl } from "../api";

interface MediaThumbnailProps {
  file: MediaFile;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: "w-9 h-9",
  md: "w-16 h-16",
  lg: "w-full aspect-square",
} as const;

function FileIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? "w-4 h-4 shrink-0";
  switch (type) {
    case "image":
      return <FileImage className={`${cls} text-emerald-400`} />;
    case "video":
      return <FileVideo className={`${cls} text-blue-400`} />;
    case "audio":
      return <FileAudio className={`${cls} text-purple-400`} />;
    default:
      return <File className={`${cls} text-slate-400`} />;
  }
}

export default function MediaThumbnail({ file, size = "sm", className = "" }: MediaThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE_MAP[size];

  if (file.status === 0 || failed || file.file_type !== "image") {
    return (
      <div
        className={`${sizeClass} rounded bg-slate-800/80 shrink-0 flex items-center justify-center ${className}`}
      >
        <FileIcon type={file.file_type} className={size === "sm" ? "w-4 h-4" : "w-6 h-6"} />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center ${className}`}
    >
      <img
        src={toAssetUrl(file.path)}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export { FileIcon };
