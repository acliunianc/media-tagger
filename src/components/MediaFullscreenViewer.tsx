import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { MediaFile } from "../types";
import { toAssetUrl } from "../api";

interface MediaFullscreenViewerProps {
  file: MediaFile;
  open: boolean;
  onClose: () => void;
}

export default function MediaFullscreenViewer({
  file,
  open,
  onClose,
}: MediaFullscreenViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      videoRef.current?.pause();
      return;
    }
    if (file.file_type === "video") {
      videoRef.current?.play().catch(() => {});
    }
  }, [open, file.file_type]);

  if (!open) return null;

  const src = toAssetUrl(file.path);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
        title="关闭 (Esc)"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="max-w-[95vw] max-h-[95vh] flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {file.file_type === "image" ? (
          <img
            src={src}
            alt={file.filename}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            draggable={false}
          />
        ) : (
          <video
            ref={videoRef}
            src={src}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl bg-video"
          />
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[80vw] truncate text-sm text-white/80 pointer-events-none">
        {file.filename}
      </div>
    </div>
  );
}
