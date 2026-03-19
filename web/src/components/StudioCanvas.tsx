// ============================================================
// 奇妙奇遇光影集 排版 Studio — 画布交互组件
// Design: 专业暗夜工作台
// 功能: 绘制图框、选择（含多选/框选）、移动、缩放手柄
//       双击图框进入图片调节模式（平移/缩放图片）
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
  type: "draw" | "move" | "resize" | "marquee" | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  slotId?: string;
  resizeHandle?: ResizeHandle;
  initialSlot?: Slot;
  initialSlots?: Slot[]; // 多选移动时记录所有初始位置
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
    state: { canvas, slots, assets, selectedSlotId, selectedSlotIds, mode, zoom },
    addSlot,
    selectSlot,
    selectSlots,
    updateSlot,
    fillSlot,
    unfillSlot,
    setZoom,
  } = useStudio();

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({ type: null, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const [drawingSlot, setDrawingSlot] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ─── 图片调节模式 ─────────────────────────────────────────
  // 当前正在调节图片的图框 ID（null = 未进入图片调节模式）
  const [imageEditSlotId, setImageEditSlotId] = useState<string | null>(null);
  // 图片调节拖拽状态（使用 ref 避免闭包问题）
  const imgDragRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    initOffX: number;
    initOffY: number;
  }>({ active: false, startClientX: 0, startClientY: 0, initOffX: 0, initOffY: 0 });

  // 旋转拖拽状态
  const rotDragRef = useRef<{
    active: boolean;
    slotId: string;
    centerX: number; // 图框中心屏幕坐标
    centerY: number;
    startAngle: number; // 拖拽开始时的角度
    initRotation: number; // 开始时的旋转角度
  }>({ active: false, slotId: "", centerX: 0, centerY: 0, startAngle: 0, initRotation: 0 });

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

  // ─── 退出图片调节模式 ─────────────────────────────────────
  const exitImageEdit = useCallback(() => {
    setImageEditSlotId(null);
  }, []);

  // Escape 退出图片调节模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && imageEditSlotId) {
        exitImageEdit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageEditSlotId, exitImageEdit]);

  // 重置图片变换自定义事件
  useEffect(() => {
    const handleReset = (e: Event) => {
      const detail = (e as CustomEvent).detail as { slotId: string };
      if (detail?.slotId) {
        updateSlot(detail.slotId, { offsetX: 0, offsetY: 0, scale: 1, rotation: 0 });
      }
    };
    window.addEventListener("reset-image-transform", handleReset);
    return () => window.removeEventListener("reset-image-transform", handleReset);
  }, [updateSlot]);

  // ─── 旋转拖拽事件监听 ──────────────────────────────────────────────
  useEffect(() => {
    if (!imageEditSlotId) return;

    const handleRotMouseMove = (e: MouseEvent) => {
      if (!rotDragRef.current.active) return;
      const { centerX, centerY, startAngle, initRotation } = rotDragRef.current;
      // 计算当前鼠标相对图框中心的角度
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      const deltaAngle = currentAngle - startAngle;
      let newRotation = initRotation + deltaAngle;
      // 归一化到 -180 ~ 180
      newRotation = ((newRotation + 180) % 360) - 180;
      updateSlot(rotDragRef.current.slotId, { rotation: round(newRotation, 1) });
    };

    const handleRotMouseUp = () => {
      rotDragRef.current.active = false;
    };

    window.addEventListener("mousemove", handleRotMouseMove);
    window.addEventListener("mouseup", handleRotMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleRotMouseMove);
      window.removeEventListener("mouseup", handleRotMouseUp);
    };
  }, [imageEditSlotId, updateSlot]);

  // ─── 图片调节模式：鼠标事件 ──────────────────────────────
  useEffect(() => {
    if (!imageEditSlotId) return;

    const handleImgMouseMove = (e: MouseEvent) => {
      if (!imgDragRef.current.active) return;
      const slot = slots.find((s) => s.id === imageEditSlotId);
      if (!slot) return;

      // 计算图框在屏幕上的像素尺寸
      const slotPxW = (slot.w / 100) * displayW;
      const slotPxH = (slot.h / 100) * displayH;

      // 鼠标移动量转换为百分比偏移（相对于图框尺寸）
      const dxPx = e.clientX - imgDragRef.current.startClientX;
      const dyPx = e.clientY - imgDragRef.current.startClientY;
      const dxPct = (dxPx / slotPxW) * 100;
      const dyPct = (dyPx / slotPxH) * 100;

      const newOffX = clamp(imgDragRef.current.initOffX + dxPct, -200, 200);
      const newOffY = clamp(imgDragRef.current.initOffY + dyPct, -200, 200);

      updateSlot(imageEditSlotId, {
        offsetX: round(newOffX, 2),
        offsetY: round(newOffY, 2),
      });
    };

    const handleImgMouseUp = () => {
      imgDragRef.current.active = false;
    };

    window.addEventListener("mousemove", handleImgMouseMove);
    window.addEventListener("mouseup", handleImgMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleImgMouseMove);
      window.removeEventListener("mouseup", handleImgMouseUp);
    };
  }, [imageEditSlotId, slots, displayW, displayH, updateSlot]);

  // ─── 鼠标按下（画布主体） ─────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // 点击画布空白区域退出图片调节模式
      if (imageEditSlotId) {
        exitImageEdit();
        return;
      }
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
        // 框选模式
        e.preventDefault();
        dragRef.current = {
          type: "marquee",
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
        };
        setMarquee({ x, y, w: 0, h: 0 });
        setIsDragging(true);
        if (!e.shiftKey) {
          selectSlot(null);
          selectSlots([]);
        }
      }
    },
    [mode, getCanvasPct, selectSlot, selectSlots, imageEditSlotId, exitImageEdit]
  );

  // ─── 图框鼠标按下（选择/移动/图片调节） ──────────────────
  const handleSlotMouseDown = useCallback(
    (e: React.MouseEvent, slot: Slot) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      // 图片调节模式下：在当前图框内按下 → 开始拖拽图片
      if (imageEditSlotId === slot.id) {
        imgDragRef.current = {
          active: true,
          startClientX: e.clientX,
          startClientY: e.clientY,
          initOffX: slot.offsetX,
          initOffY: slot.offsetY,
        };
        return;
      }

      // 图片调节模式下：点击其他图框 → 退出当前调节模式，选中新图框
      if (imageEditSlotId && imageEditSlotId !== slot.id) {
        exitImageEdit();
      }

      if (e.shiftKey) {
        // Shift+点击：切换多选
        const newIds = selectedSlotIds.includes(slot.id)
          ? selectedSlotIds.filter((id) => id !== slot.id)
          : [...selectedSlotIds, slot.id];
        selectSlots(newIds);
        selectSlot(newIds.length === 1 ? newIds[0] : null);
        return;
      }

      // 普通点击
      if (!selectedSlotIds.includes(slot.id)) {
        selectSlots([slot.id]);
      }
      selectSlot(slot.id);

      if (mode === "select") {
        const { x, y } = getCanvasPct(e.clientX, e.clientY);
        const idsToMove = selectedSlotIds.includes(slot.id) && selectedSlotIds.length > 1
          ? selectedSlotIds
          : [slot.id];
        dragRef.current = {
          type: "move",
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          slotId: slot.id,
          initialSlot: { ...slot },
          initialSlots: slots.filter((s) => idsToMove.includes(s.id)).map((s) => ({ ...s })),
        };
        setIsDragging(true);
      }
    },
    [mode, getCanvasPct, selectSlot, selectSlots, selectedSlotIds, slots, imageEditSlotId, exitImageEdit]
  );

  // ─── 图框双击（进入图片调节模式） ────────────────────────
  const handleSlotDoubleClick = useCallback(
    (e: React.MouseEvent, slot: Slot) => {
      e.stopPropagation();
      // 只有有图片的图框才能进入图片调节模式
      if (slot.assetId) {
        setImageEditSlotId(slot.id);
        selectSlot(slot.id);
        selectSlots([slot.id]);
      }
    },
    [selectSlot, selectSlots]
  );

  // ─── 图片调节模式：滚轮缩放（普通）/ 旋转（Shift+滚轮） ────────────────────────
  const handleSlotWheel = useCallback(
    (e: React.WheelEvent, slot: Slot) => {
      if (imageEditSlotId !== slot.id) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        // Shift+滚轮 = 旋转（每格 3°）
        const delta = e.deltaY > 0 ? 3 : -3;
        let newRotation = ((slot.rotation ?? 0) + delta + 180) % 360 - 180;
        updateSlot(slot.id, { rotation: round(newRotation, 1) });
      } else {
        // 普通滚轮 = 缩放
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const newScale = clamp((slot.scale || 1) + delta, 0.1, 5.0);
        updateSlot(slot.id, { scale: round(newScale, 3) });
      }
    },
    [imageEditSlotId, updateSlot]
  );

  // ─── 旋转手柄鼠标按下 ──────────────────────────────────────────────
  const handleRotateMouseDown = useCallback(
    (e: React.MouseEvent, slot: Slot) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      // 计算图框中心屏幕坐标
      const slotEl = (e.currentTarget as HTMLElement).closest("[data-slot]") as HTMLElement;
      if (!slotEl) return;
      const rect = slotEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      // 计算开始角度
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      rotDragRef.current = {
        active: true,
        slotId: slot.id,
        centerX,
        centerY,
        startAngle,
        initRotation: slot.rotation ?? 0,
      };
    },
    []
  );

  // ─── 缩放手柄鼠标按下 ───────────────────────────────────────────────
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

  // ─── 鼠标移动（绘制/移动/缩放/框选） ──────────────────────
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
      } else if (drag.type === "marquee") {
        const sx = Math.min(drag.startX, x);
        const sy = Math.min(drag.startY, y);
        const sw = Math.abs(x - drag.startX);
        const sh = Math.abs(y - drag.startY);
        setMarquee({ x: sx, y: sy, w: sw, h: sh });
      } else if (drag.type === "move" && drag.slotId && drag.initialSlot) {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        // 多选移动
        if (drag.initialSlots && drag.initialSlots.length > 1) {
          drag.initialSlots.forEach((init) => {
            const newX = clamp(init.x + dx, 0, 100 - init.w);
            const newY = clamp(init.y + dy, 0, 100 - init.h);
            updateSlot(init.id, { x: round(newX, 2), y: round(newY, 2) });
          });
        } else {
          const init = drag.initialSlot;
          const newX = clamp(init.x + dx, 0, 100 - init.w);
          const newY = clamp(init.y + dy, 0, 100 - init.h);
          updateSlot(drag.slotId, { x: round(newX, 2), y: round(newY, 2) });
        }
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

    const handleMouseUp = (e: MouseEvent) => {
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
          selectSlots([slot.id]);
        }
        setDrawingSlot(null);
      } else if (drag.type === "marquee" && marquee) {
        // 框选：找出与框选区域相交的图框
        if (marquee.w > 0.5 && marquee.h > 0.5) {
          const hit = slots.filter((s) => {
            return (
              s.x < marquee.x + marquee.w &&
              s.x + s.w > marquee.x &&
              s.y < marquee.y + marquee.h &&
              s.y + s.h > marquee.y
            );
          });
          const hitIds = hit.map((s) => s.id);
          if (e.shiftKey) {
            // Shift 框选：追加到现有选中
            const merged = Array.from(new Set([...selectedSlotIds, ...hitIds]));
            selectSlots(merged);
            selectSlot(merged.length === 1 ? merged[0] : null);
          } else {
            selectSlots(hitIds);
            selectSlot(hitIds.length === 1 ? hitIds[0] : null);
          }
        }
        setMarquee(null);
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
  }, [isDragging, drawingSlot, marquee, addSlot, selectSlot, selectSlots, updateSlot, getCanvasPct, slots, selectedSlotIds]);

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

  // Ctrl+滚轮缩放画布（图片调节模式下不触发）
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (imageEditSlotId) return; // 图片调节模式下不缩放画布
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(clamp(zoom + delta, 0.2, 4.0));
    },
    [zoom, setZoom, imageEditSlotId]
  );

  return (
    <div
      ref={scrollRef}
      className="w-full h-full overflow-auto"
      style={{
        background: "oklch(0.10 0.01 260)",
        backgroundImage: `
          radial-gradient(ellipse at 15% 15%, oklch(0.18 0.04 264 / 0.25) 0%, transparent 45%),
          radial-gradient(ellipse at 85% 85%, oklch(0.16 0.03 280 / 0.15) 0%, transparent 45%)
        `,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onWheel={handleWheel}
    >
      {/* 内层 wrapper：minWidth/minHeight 确保画布比容器大时可以滚动，小时 flex 自动居中 */}
      <div
        style={{
          padding: 32,
          minWidth: displayW + 64,
          minHeight: displayH + 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
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
            isMultiSelected={selectedSlotIds.includes(slot.id)}
            isImageEditMode={imageEditSlotId === slot.id}
            zoom={zoom}
            onMouseDown={handleSlotMouseDown}
            onDoubleClick={handleSlotDoubleClick}
            onWheel={handleSlotWheel}
            onResizeMouseDown={handleResizeMouseDown}
            onRotateMouseDown={handleRotateMouseDown}
            onDrop={handleSlotDrop}
            onDragOver={handleSlotDragOver}
            onUnfill={() => unfillSlot(slot.id)}
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

        {/* 框选预览 */}
        {marquee && marquee.w > 0.5 && marquee.h > 0.5 && (
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: `${marquee.x}%`,
              top: `${marquee.y}%`,
              width: `${marquee.w}%`,
              height: `${marquee.h}%`,
              border: "1.5px dashed oklch(0.58 0.22 264 / 0.9)",
              backgroundColor: "oklch(0.58 0.22 264 / 0.06)",
            }}
          />
        )}

        {/* 图片调节模式提示 */}
        {imageEditSlotId && (
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            style={{
              background: "oklch(0.15 0.02 264 / 0.92)",
              border: "1px solid oklch(0.55 0.18 145 / 0.6)",
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 11,
              color: "oklch(0.75 0.12 145)",
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
            }}
          >
            图片调节模式 · 拖动平移 · 滚轮缩放 · Esc 退出
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
// ─── 单个图框渲染器 ──────────────────────────────────────────────
interface SlotRendererProps {
  slot: Slot;
  asset: import("@/lib/types").Asset | null;
  isSelected: boolean;
  isMultiSelected: boolean;
  isImageEditMode: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent, slot: Slot) => void;
  onDoubleClick: (e: React.MouseEvent, slot: Slot) => void;
  onWheel: (e: React.WheelEvent, slot: Slot) => void;
  onResizeMouseDown: (e: React.MouseEvent, slot: Slot, handle: ResizeHandle) => void;
  onRotateMouseDown: (e: React.MouseEvent, slot: Slot) => void;
  onDrop: (e: React.DragEvent, slotId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onUnfill: () => void;
}

function SlotRenderer({
  slot,
  asset,
  isSelected,
  isMultiSelected,
  isImageEditMode,
  zoom,
  onMouseDown,
  onDoubleClick,
  onWheel,
  onResizeMouseDown,
  onRotateMouseDown,
  onDrop,
  onDragOver,
  onUnfill,
}: SlotRendererProps) {
  const hasFill = !!asset;

  // 边框颜色：图片调节模式=绿色，选中=蓝色，多选=橙色，空框=虚线蓝
  const outlineStyle = isImageEditMode
    ? "2px solid oklch(0.65 0.20 145)"
    : isSelected
    ? "2px solid oklch(0.58 0.22 264)"
    : isMultiSelected
    ? "2px solid oklch(0.72 0.16 55)"
    : hasFill
    ? "none"
    : "1.5px dashed oklch(0.58 0.22 264 / 0.55)";

  const boxShadowStyle = isImageEditMode
    ? "0 0 0 2px oklch(0.65 0.20 145), 0 0 20px oklch(0.65 0.20 145 / 0.3)"
    : isSelected
    ? "0 0 0 2px oklch(0.58 0.22 264), 0 0 20px oklch(0.58 0.22 264 / 0.3)"
    : isMultiSelected
    ? "0 0 0 1px oklch(0.72 0.16 55 / 0.5)"
    : "none";

  return (
    <div
      data-slot
      className={cn(
        "absolute group",
        isSelected || isImageEditMode ? "z-20" : isMultiSelected ? "z-15" : "z-10"
      )}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: `${slot.w}%`,
        height: `${slot.h}%`,
        outline: outlineStyle,
        boxShadow: boxShadowStyle,
        cursor: isImageEditMode ? "grab" : "move",
        overflow: "hidden",
        transition: "box-shadow 0.15s ease, outline 0.15s ease",
      }}
      onMouseDown={(e) => onMouseDown(e, slot)}
      onDoubleClick={(e) => onDoubleClick(e, slot)}
      onWheel={(e) => onWheel(e, slot)}
      onDrop={(e) => onDrop(e, slot.id)}
      onDragOver={onDragOver}
    >
      {/* 图片填充 */}
      {asset && (
        <div className="absolute inset-0 overflow-hidden">
          <AspectFillImage asset={asset} slot={slot} />
          {/* 图片调节模式标识角标 */}
          {isImageEditMode && (
            <div
              className="absolute top-1 left-1 z-40 pointer-events-none"
              style={{
                background: "oklch(0.65 0.20 145 / 0.9)",
                borderRadius: 3,
                padding: "1px 5px",
                fontSize: 9,
                color: "white",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              图片
            </div>
          )}
          {/* 删除当前图片按钮：悬停时显示，图片调节模式下隐藏 */}
          {!isImageEditMode && (
            <button
              className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-40"
              style={{ background: "oklch(0.62 0.22 25 / 0.92)", border: "1px solid oklch(1 0 0 / 0.2)" }}
              title="清空图片"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUnfill(); }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
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

      {/* 缩放手柄（选中且非图片调节模式时显示） */}
      {isSelected && !isImageEditMode &&
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

      {/* 图片调节模式：旋转手柄（图框四角外侧） */}
      {isImageEditMode && asset && (
        <>
          {/* 旋转手柄：右上角（主手柄，最常用） */}
          <div
            className="absolute z-50"
            style={{
              top: -20,
              right: -20,
              width: 16,
              height: 16,
              cursor: "crosshair",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseDown={(e) => { e.stopPropagation(); onRotateMouseDown(e, slot); }}
            title="拖动旋转图片"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="oklch(0.65 0.20 145)" strokeWidth="1.5" fill="oklch(0.15 0.02 264 / 0.85)"/>
              <path d="M4.5 4.5 A3.5 3.5 0 1 1 4.5 9.5" stroke="oklch(0.75 0.15 145)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M3 3.5 L4.5 4.5 L5.5 3" stroke="oklch(0.75 0.15 145)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          {/* 左上角旋转手柄 */}
          <div
            className="absolute z-50"
            style={{
              top: -20,
              left: -20,
              width: 16,
              height: 16,
              cursor: "crosshair",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseDown={(e) => { e.stopPropagation(); onRotateMouseDown(e, slot); }}
            title="拖动旋转图片"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="oklch(0.65 0.20 145)" strokeWidth="1.5" fill="oklch(0.15 0.02 264 / 0.85)"/>
              <path d="M4.5 4.5 A3.5 3.5 0 1 1 4.5 9.5" stroke="oklch(0.75 0.15 145)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M3 3.5 L4.5 4.5 L5.5 3" stroke="oklch(0.75 0.15 145)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          {/* 重置按钮 */}
          <button
            className="absolute bottom-1 right-1 z-40 flex items-center gap-1"
            style={{
              background: "oklch(0.15 0.02 264 / 0.85)",
              border: "1px solid oklch(0.65 0.20 145 / 0.5)",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 9,
              color: "oklch(0.75 0.12 145)",
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              (e.currentTarget as HTMLElement).dispatchEvent(
                new CustomEvent("reset-image-transform", { bubbles: true, detail: { slotId: slot.id } })
              );
            }}
            title="重置图片位置、缩放和旋转"
          >
            重置
          </button>
          {/* 旋转角度显示 */}
          {(slot.rotation ?? 0) !== 0 && (
            <div
              className="absolute bottom-1 left-1 z-40 pointer-events-none"
              style={{
                background: "oklch(0.15 0.02 264 / 0.85)",
                border: "1px solid oklch(0.65 0.20 145 / 0.4)",
                borderRadius: 3,
                padding: "1px 5px",
                fontSize: 9,
                color: "oklch(0.75 0.12 145)",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {Math.round(slot.rotation ?? 0)}°
            </div>
          )}
        </>
      )}
    </div>
  );
}
// ─── 图片渲染（支持 offsetX/offsetY/scale/rotation）────
function AspectFillImage({
  asset,
  slot,
}: {
  asset: import("@/lib/types").Asset;
  slot: Slot;
}) {
  const displayUrl = asset.croppedDataUrl ?? asset.dataUrl;
  const offsetX = slot.offsetX ?? 0;
  const offsetY = slot.offsetY ?? 0;
  const scale = slot.scale ?? 1;
  const rotation = slot.rotation ?? 0;

  return (
    <img
      src={displayUrl}
      alt={asset.name}
      draggable={false}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        // cover 模式：图片铺满图框，保持比例
        objectFit: "cover",
        objectPosition: "center center",
        // 应用平移、缩放、旋转
        transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale}) rotate(${rotation}deg)`,
        transformOrigin: "center center",
        userSelect: "none",
        pointerEvents: "none",
      }}
    />
  );
}
