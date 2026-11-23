import { useRef, useState, type FC, type PointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const VIEWPORT = 168;
const OUTPUT = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface AvatarCropperProps {
  /** Object URL or data URL of the picked image. */
  src: string;
  hint?: string;
  confirmLabel?: string;
  restartLabel?: string;
  busy?: boolean;
  onRestart: () => void;
  /** The framed square as a PNG. */
  onConfirm: (file: File) => void;
}

/** Mount with `key={src}` so each image starts centred at 1x. Drag to reposition, slide to zoom; "Set avatar" renders exactly what the round preview shows. */
export const AvatarCropper: FC<AvatarCropperProps> = ({ src, hint = "Drag to reposition", confirmLabel = "Set avatar", restartLabel = "Restart", busy, onRestart, onConfirm }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const base = natural ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1;
  const width = natural ? natural.w * base * zoom : VIEWPORT;
  const height = natural ? natural.h * base * zoom : VIEWPORT;

  const clamp = (x: number, y: number, w = width, h = height) => ({
    x: Math.max(-(w - VIEWPORT) / 2, Math.min((w - VIEWPORT) / 2, x)),
    y: Math.max(-(h - VIEWPORT) / 2, Math.min((h - VIEWPORT) / 2, y)),
  });

  const changeZoom = (next: number) => {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    setZoom(z);
    if (natural) setOffset((o) => clamp(o.x, o.y, natural.w * base * z, natural.h * base * z));
  };

  const onPointerDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return;
    setOffset(clamp(drag.current.ox + e.clientX - drag.current.x, drag.current.oy + e.clientY - drag.current.y));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = OUTPUT / VIEWPORT;
    ctx.drawImage(img, (VIEWPORT - width) / 2 * ratio + offset.x * ratio, (VIEWPORT - height) / 2 * ratio + offset.y * ratio, width * ratio, height * ratio);
    canvas.toBlob((blob) => blob && onConfirm(new File([blob], "avatar.png", { type: "image/png" })), "image/png");
  };

  return (
    <div className="flex flex-col items-center gap-4 px-1 pb-1 pt-2">
      <div
        className="relative cursor-grab touch-none overflow-hidden rounded-full bg-surface-sunken active:cursor-grabbing"
        style={{ width: VIEWPORT, height: VIEWPORT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(e) => changeZoom(zoom - e.deltaY * 0.002)}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          crossOrigin="anonymous"
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
          style={{ width, height, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <div className="flex w-full items-center gap-3">
        <button type="button" aria-label="Zoom out" className="text-muted-foreground hover:text-ink" onClick={() => changeZoom(zoom - 0.25)}>
          <Minus className="h-4 w-4" />
        </button>
        <input type="range" aria-label="Zoom" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} className="h-1 flex-1 cursor-pointer accent-[var(--ink)]" />
        <button type="button" aria-label="Zoom in" className="text-muted-foreground hover:text-ink" onClick={() => changeZoom(zoom + 0.25)}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={onRestart} disabled={busy}>
          {restartLabel}
        </Button>
        <Button type="button" className="rounded-full" onClick={confirm} loading={busy} disabled={!natural}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
};
