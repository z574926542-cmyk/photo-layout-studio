// ============================================================
// 奇妙奇遇光影集 排版 Studio — 画布交互组件
// Design: 专业暗夜工作台
// 功能: 绘制图框、选择、移动、缩放手柄、Contain 渲染
//       裁剪功能已移至右侧素材库（预处理），画布不含裁剪模式
// ============================================================
import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
} from "react";
import { useStudio } from "@/contexts/StudioContext";
import type { Slot, ResizeHandle } from "@/lib/types";
import { toPct, clamp, round, createSlot } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DragState {
  type: "draw" | "move" | "resize" | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  slotId?: string;
  resizeHandle?: ResizeHandle;
  initialSlot?: Slot;
}

const HANDLE_SIZE = 8;
const MIN_SLOT_PCT = 1.5;

const RESIZE_HANDLES: ResizeHandle[] = [
  "nw", "n", "ne",
  "w",        "e",
  "sw", "s", "se",
];

function getHandleStyle(handle: ResizeHandle): React.CSSProperties {
  const half = HANDLE_SIZE / 2;
  const pos: Record<ResizeHandle, React.CSSProperties> = {
    nw: { top: -half, left: -half, cursor: "nw-resize" },
    n:  { top: -half, left: `calc(50% - ${half}px)`, cursor: "n-resize" },
    ne: { top: -half, right: -half, cursor: "ne-resize" },
    w:  { top: `calc(50% - ${half}px)`, left: -half, cursor: "w-resize" },
    e:  { top: `calc(50% - ${half}px)`, right: -half, cursor: "e-resize" },
    sw: { bottom: -half, left: -half, cursor: "sw-resize" },
    s:  { bottom: -half, left: `calc(50% - ${half}px)`, cursor: "s-resize" },
    se: { bottom: -half, right: -half, cursor: "se-resize" },
  };
  return pos[handle];
}

export default function StudioCanvas() {
  const {
    state: { canvas, slots, assets, selectedSlotId, mode, zoom },
    addSlot,
    selectSlot,
    updateSlot,
    fillSlot,
    setZoom,
  } = useStudio();

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({ type: null, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const [drawingSlot, setDrawingSlot] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 画布显示尺寸
  const displayW = canvas.width * zoom;
  const displayH = canvas.height * zoom;

  // 获取画布相对坐标（百分比）
  const getCanvasPct = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const x = toPct(clientX - rect.left, rect.width);
      const y = toPct(clientY - rect.top, rect.height);
      return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
    },
    []
  );

  // ─── 鼠标按下（画布主体） ─────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-slot]")) return;
      const { x, y } = getCanvasPct(e.clientX, e.clientY);

      if (mode === "draw") {
        e.preventDefault();
        dragRef.current = {
          type: "draw",
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
        };
        setDrawingSlot({ x, y, w: 0, h: 0 });
        setIsDragging(true);
      } else {
        selectSlot(null);
      }
    },
    [mode, getCanvasPct, selectSlot]
  );

  // ─── 图框鼠标按下（选择/移动） ────────────────────────────
  const handleSlotMouseDown = useCallback(
    (e: React.MouseEvent, slot: Slot) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      selectSlot(slot.id);

      if (mode === "select") {
        const { x, y } = getCanvasPct(e.clientX, e.clientY);
        dragRef.current = {
          type: "move",
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          slotId: slot.id,
          initialSlot: { ...slot },
        };
        setIsDragging(true);
      }
    },
    [mode, getCanvasPct, selectSlot]
  );

  // ─── 缩放手柄鼠标按下 ─────────────────────────────────────
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, slot: Slot, handle: ResizeHandle) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const { x, y } = getCanvasPct(e.clientX, e.clientY);
      dragRef.current = {
        type: "resize",
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        slotId: slot.id,
        resizeHandle: handle,
        initialSlot: { ...slot },
      };
      setIsDragging(true);
    },
    [getCanvasPct]
  );

  // ─── 鼠标移动（绘制/移动/缩放） ──────────────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const { x, y } = getCanvasPct(e.clientX, e.clientY);
      const drag = dragRef.current;
      drag.currentX = x;
      drag.currentY = y;

      if (drag.type === "draw") {
        const sx = Math.min(drag.startX, x);
        const sy = Math.min(drag.startY, y);
        const sw = Math.abs(x - drag.startX);
        const sh = Math.abs(y - drag.startY);
        setDrawingSlot({ x: sx, y: sy, w: sw, h: sh });
      } else if (drag.type === "move" && drag.slotId && drag.initialSlot) {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        const init = drag.initialSlot;
        const newX = clamp(init.x + dx, 0, 100 - init.w);
        const newY = clamp(init.y + dy, 0, 100 - init.h);
        updateSlot(drag.slotId, {
          x: round(newX, 2),
          y: round(newY, 2),
        });
      } else if (drag.type === "resize" && drag.slotId && drag.initialSlot && drag.resizeHandle) {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        const init = drag.initialSlot;
        let { x: nx, y: ny, w: nw, h: nh } = init;

        const h = drag.resizeHandle;
        if (h.includes("e")) nw = Math.max(MIN_SLOT_PCT, init.w + dx);
        if (h.includes("s")) nh = Math.max(MIN_SLOT_PCT, init.h + dy);
        if (h.includes("w")) {
          const newW = Math.max(MIN_SLOT_PCT, init.w - dx);
          nx = init.x + (init.w - newW);
          nw = newW;
        }
        if (h.includes("n")) {
          const newH = Math.max(MIN_SLOT_PCT, init.h - dy);
          ny = init.y + (init.h - newH);
          nh = newH;
        }

        nx = clamp(nx, 0, 100);
        ny = clamp(ny, 0, 100);
        nw = clamp(nw, MIN_SLOT_PCT, 100 - nx);
        nh = clamp(nh, MIN_SLOT_PCT, 100 - ny);

        updateSlot(drag.slotId, {
          x: round(nx, 2),
          y: round(ny, 2),
          w: round(nw, 2),
          h: round(nh, 2),
        });
      }
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      const drag = dragRef.current;

      if (drag.type === "draw" && drawingSlot) {
        if (drawingSlot.w >= MIN_SLOT_PCT && drawingSlot.h >= MIN_SLOT_PCT) {
          const slot = createSlot(
            drawingSlot.x,
            drawingSlot.y,
            drawingSlot.w,
            drawingSlot.h
          );
          addSlot(slot);
          selectSlot(slot.id);
        }
        setDrawingSlot(null);
      }

      dragRef.current = { type: null, startX: 0, startY: 0, currentX: 0, currentY: 0 };
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, drawingSlot, addSlot, selectSlot, updateSlot, getCanvasPct]);

  // 处理素材拖放到图框
  const handleSlotDrop = useCallback(
    (e: React.DragEvent, slotId: string) => {
      e.preventDefault();
      const assetId = e.dataTransfer.getData("assetId");
      if (assetId) {
        fillSlot(slotId, assetId);
      }
    },
    [fillSlot]
  );

  const handleSlotDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Ctrl+滚轮缩放画布
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(clamp(zoom + delta, 0.2, 4.0));
    },
    [zoom, setZoom]
  );

  return (
    <div
      className="w-full h-full overflow-auto"
      style={{
        background: "oklch(0.10 0.01 260)",
        backgroundImage: `
          radial-gradient(ellipse at 15% 15%, oklch(0.18 0.04 264 / 0.25) 0%, transparent 45%),
          radial-gradient(ellipse at 85% 85%, oklch(0.16 0.03 280 / 0.15) 0%, transparent 45%)
        `,
      }}
      onWheel={handleWheel}
    >
      <div
        className="flex items-center justify-center p-8"
        style={{ minWidth: displayW + 64, minHeight: displayH + 64 }}
      >
      {/* 画布主体 */}
      <div
        ref={canvasRef}
        data-canvas="true"
        className={cn(
          "relative flex-shrink-0 select-none overflow-hidden",
          mode === "draw" ? "cursor-crosshair" : "cursor-default"
        )}
        style={{
          width: displayW,
          height: displayH,
          boxShadow: "0 12px 60px oklch(0 0 0 / 0.7), 0 4px 16px oklch(0 0 0 / 0.5)",
          outline: "1px solid oklch(1 0 0 / 0.1)",
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 背景 */}
        {canvas.backgroundImage ? (
          <img
            src={canvas.backgroundImage}
            alt="background"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: canvas.backgroundColor }}
          />
        )}

        {/* 图框列表 */}
        {slots.map((slot) => (
          <SlotRenderer
            key={slot.id}
            slot={slot}
            asset={assets.find((a) => a.id === slot.assetId) ?? null}
            isSelected={slot.id === selectedSlotId}
            zoom={zoom}
            onMouseDown={handleSlotMouseDown}
            onResizeMouseDown={handleResizeMouseDown}
            onDrop={handleSlotDrop}
            onDragOver={handleSlotDragOver}
          />
        ))}

        {/* 正在绘制的图框预览 */}
        {drawingSlot && drawingSlot.w > 0.5 && drawingSlot.h > 0.5 && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${drawingSlot.x}%`,
              top: `${drawingSlot.y}%`,
              width: `${drawingSlot.w}%`,
              height: `${drawingSlot.h}%`,
              border: "2px dashed oklch(0.72 0.16 55)",
              backgroundColor: "oklch(0.72 0.16 55 / 0.08)",
              boxShadow: "0 0 0 1px oklch(0.72 0.16 55 / 0.3)",
            }}
          />
        )}
      </div>
      </div>
    </div>
  );
}

// ─── 单个图框渲染器 ────────────────────────────────────────
interface SlotRendererProps {
  slot: Slot;
  asset: import("@/lib/types").Asset | null;
  isSelected: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent, slot: Slot) => void;
  onResizeMouseDown: (e: React.MouseEvent, slot: Slot, handle: ResizeHandle) => void;
  onDrop: (e: React.DragEvent, slotId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
}

function SlotRenderer({
  slot,
  asset,
  isSelected,
  zoom,
  onMouseDown,
  onResizeMouseDown,
  onDrop,
  onDragOver,
}: SlotRendererProps) {
  const hasFill = !!asset;

  return (
    <div
      data-slot
      className={cn(
        "absolute group",
        isSelected ? "z-20" : "z-10"
      )}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: `${slot.w}%`,
        height: `${slot.h}%`,
        outline: isSelected
          ? "2px solid oklch(0.58 0.22 264)"
          : hasFill
          ? "none"
          : "1.5px dashed oklch(0.58 0.22 264 / 0.55)",
        boxShadow: isSelected
          ? "0 0 0 2px oklch(0.58 0.22 264), 0 0 20px oklch(0.58 0.22 264 / 0.3)"
          : "none",
        cursor: "move",
        overflow: "hidden",
        transition: "box-shadow 0.15s ease, outline 0.15s ease",
      }}
      onMouseDown={(e) => onMouseDown(e, slot)}
      onDrop={(e) => onDrop(e, slot.id)}
      onDragOver={onDragOver}
    >
      {/* 图片填充（Contain 模式：内容完整显示） */}
      {asset && (
        <div className="absolute inset-0 overflow-hidden">
          <AspectFillImage asset={asset} slot={slot} />
        </div>
      )}

      {/* 空框内容 */}
      {!hasFill && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ background: "oklch(0.58 0.22 264 / 0.04)" }}
        >
          <div
            className="text-center px-2"
            style={{
              color: "oklch(0.58 0.22 264 / 0.7)",
            }}
          >
            {slot.label && (
              <div
                className="font-semibold mb-0.5 truncate"
                style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: `${Math.max(10, Math.min(18, slot.w * zoom * 0.14))}px`,
                }}
              >
                {slot.label}
              </div>
            )}
            <div
              style={{
                fontFamily: "monospace",
                fontSize: `${Math.max(8, Math.min(12, slot.w * zoom * 0.1))}px`,
                opacity: 0.7,
              }}
            >
              {slot.w.toFixed(1)}% × {slot.h.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* 缩放手柄 */}
      {isSelected &&
        RESIZE_HANDLES.map((handle) => (
          <div
            key={handle}
            className="absolute z-30"
            style={{
              ...getHandleStyle(handle),
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              backgroundColor: "oklch(0.58 0.22 264)",
              border: "1.5px solid white",
              borderRadius: 2,
            }}
            onMouseDown={(e) => onResizeMouseDown(e, slot, handle)}
          />
        ))}
    </div>
  );
}

// ─── Contain 图片渲染（保证图片内容完整显示，不裁剪）─────
function AspectFillImage({
  asset,
  slot,
}: {
  asset: import("@/lib/types").Asset;
  slot: Slot;
}) {
  // 优先使用裁剪后的图片，如果没有裁剪则用原图
  const displayUrl = asset.croppedDataUrl ?? asset.dataUrl;
  return (
    <img
      src={displayUrl}
      alt={asset.name}
      draggable={false}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        // contain 模式：图片完整显示在图框内，保持比例，不裁剪内容
        objectFit: "contain",
        objectPosition: "center center",
        userSelect: "none",
        pointerEvents: "none",
      }}
    />
  );
}
