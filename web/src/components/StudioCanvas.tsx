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
import type { Slot, ResizeHandle, OverlayItem } from "@/lib/types";
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
    state: { canvas, slots, assets, selectedSlotId, selectedSlotIds, mode, zoom, overlays, selectedOverlayId },
    addSlot,
    selectSlot,
    selectSlots,
    updateSlot,
    fillSlot,
    unfillSlot,
    setZoom,
    updateOverlay,
    selectOverlay,
    deleteOverlay,
  } = useStudio();

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 用于原生事件处理器中访问最新状态（避免闭包问题）
  const slotsRef = useRef(slots);
  const updateSlotRef = useRef(updateSlot);
  const imageEditSlotIdRef = useRef<string | null>(null); // 初始化为 null，由 useEffect 同步
  const dragRef = useRef<DragState>({ type: null, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const [drawingSlot, setDrawingSlot] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ─── Overlay 拖拽状态 ────────────────────────────────────────────────
  const overlayDragRef = useRef<{
    active: boolean;
    type: "move" | "resize";
    overlayId: string;
    startClientX: number;
    startClientY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
    handle?: ResizeHandle;
  }>({ active: false, type: "move", overlayId: "", startClientX: 0, startClientY: 0, initX: 0, initY: 0, initW: 0, initH: 0 });

  // ─── 图片调节模式 ─────────────────────────────────────────
  // 当前正在调节图片的图框 ID（null = 未进入图片调节模式）
  const [imageEditSlotId, setImageEditSlotId] = useState<string | null>(null);
  // 同步 ref，供原生事件处理器访问最新值
  useEffect(() => { slotsRef.current = slots; }, [slots]);
  useEffect(() => { updateSlotRef.current = updateSlot; }, [updateSlot]);
  useEffect(() => { imageEditSlotIdRef.current = imageEditSlotId; }, [imageEditSlotId]);
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

  // ─── 图片缩放手柄拖拽状态 ─────────────────────────────────
  const imgScaleDragRef = useRef<{
    active: boolean;
    slotId: string;
    handle: ResizeHandle;
    startClientX: number;
    startClientY: number;
    initScale: number;
    initOffsetX: number;  // 拖拽开始时的 offsetX
    initOffsetY: number;  // 拖拽开始时的 offsetY
    slotPxW: number;      // 图框屏幕宽度
    slotPxH: number;      // 图框屏幕高度
    initImgLeft: number;  // 拖拽开始时图片左边缘（相对图框）
    initImgTop: number;   // 拖拽开始时图片上边缘（相对图框）
    initRenderW: number;  // 拖拽开始时图片渲染宽度
    initRenderH: number;  // 拖拽开始时图片渲染高度
    baseScale: number;    // cover 基准缩放（不含用户 scale）
    anchorImgX: number;   // 锚点在图片坐标系中的 X（0=左边，1=右边）
    anchorImgY: number;   // 锚点在图片坐标系中的 Y（0=上边，1=下边）
    anchorSlotX: number;  // 锚点相对图框的像素 X（拖拽时保持不动）
    anchorSlotY: number;  // 锚点相对图框的像素 Y（拖拽时保持不动）
    zoom: number;         // 拖拽开始时的画布缩放比例（用于屏幕像素转换为画布像素）
  }>({ active: false, slotId: "", handle: "se", startClientX: 0, startClientY: 0, initScale: 1, initOffsetX: 0, initOffsetY: 0, slotPxW: 0, slotPxH: 0, initImgLeft: 0, initImgTop: 0, initRenderW: 0, initRenderH: 0, baseScale: 1, anchorImgX: 0, anchorImgY: 0, anchorSlotX: 0, anchorSlotY: 0, zoom: 1 });

  // ─── 视口平移状态（空格+拖动 / 中键拖动） ─────────────────
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const panDragRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    initScrollLeft: number;
    initScrollTop: number;
  }>({ active: false, startClientX: 0, startClientY: 0, initScrollLeft: 0, initScrollTop: 0 });

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

      // 图框在屏幕上的像素尺寸
      const slotPxW = (slot.w / 100) * displayW;
      const slotPxH = (slot.h / 100) * displayH;

      // 鼠标移动量转换为百分比偏移（相对于图框尺寸）
      // non-destructive cover crop 语义：offsetX/offsetY 是图片中心相对于图框中心的偶移
      const dxPx = e.clientX - imgDragRef.current.startClientX;
      const dyPx = e.clientY - imgDragRef.current.startClientY;
      const dxPct = (dxPx / slotPxW) * 100;
      const dyPct = (dyPx / slotPxH) * 100;

      // 限制偏移范围：防止拖出层框外导致图框内出现空白
      // 最大偏移 = (renderW - slotW) / 2 / slotW * 100，但这需要知道 scale，简化用大范围限制
      const newOffX = clamp(imgDragRef.current.initOffX + dxPct, -300, 300);
      const newOffY = clamp(imgDragRef.current.initOffY + dyPct, -300, 300);

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
      // 空格键按下时，由 scrollRef 的 onMouseDown 处理平移，画布不响应其他操作
      if (isSpaceDown) return;
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
    [mode, getCanvasPct, selectSlot, selectSlots, imageEditSlotId, exitImageEdit, isSpaceDown]
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

      // 图片调节模式下：点击其他图框 → 忽略，不退出编辑模式
      // 只有点击画布空白区域（handleMouseDown）才退出
      if (imageEditSlotId && imageEditSlotId !== slot.id) {
        return;
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
    [mode, getCanvasPct, selectSlot, selectSlots, selectedSlotIds, slots, imageEditSlotId]
  );
  // ─── 图框双击（进入图片调节模式）） ────────────────────────
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
  // handleSlotWheel 改为原生事件注册（见下方 useEffect）
  // 保留空函数占位，避免破坏其他传递逻辑
  const handleSlotWheel = useCallback(
    (_e: React.WheelEvent, _slot: Slot) => {
      // 已由原生 addEventListener({ passive: false }) 处理，此处无需操作
    },
    []
  );

  // ─── 图片缩放手柄事件监听（PS Ctrl+T 等比缩放 + 锚点保持不动） ────────────────────────────────────
  useEffect(() => {
    if (!imageEditSlotId) return;
    const handleScaleMouseMove = (e: MouseEvent) => {
      const sd = imgScaleDragRef.current;
      console.log('[ScaleMove] active:', sd.active, 'slotId:', sd.slotId, 'editId:', imageEditSlotId);
      if (!sd.active || sd.slotId !== imageEditSlotId) return;

      // 屏幕像素增量（initRenderW/H 也是屏幕像素，坐标系一致）
      const dx = e.clientX - sd.startClientX;
      const dy = e.clientY - sd.startClientY;
      const h = sd.handle;

      // 图片初始尺寸（像素）和初始位置（像素，相对图框左上角）
      const iW = sd.initRenderW;   // 图片初始宽度（像素）
      const iH = sd.initRenderH;   // 图片初始高度（像素）
      const iL = sd.initImgLeft;   // 图片初始左边（像素）
      const iT = sd.initImgTop;    // 图片初始上边（像素）

      // 计算等比缩放因子（基于像素增量，保持图片原始宽高比）
      // 所有方向都等比缩放，以拖动方向的像素变化为基准
      let scaleFactor = 1;
      if (h === "e") {
        scaleFactor = (iW + dx) / iW;
      } else if (h === "w") {
        scaleFactor = (iW - dx) / iW;
      } else if (h === "s") {
        scaleFactor = (iH + dy) / iH;
      } else if (h === "n") {
        scaleFactor = (iH - dy) / iH;
      } else if (h === "se") {
        // 对角：取宽高两个方向的平均（像素比例）
        scaleFactor = ((iW + dx) / iW + (iH + dy) / iH) / 2;
      } else if (h === "sw") {
        scaleFactor = ((iW - dx) / iW + (iH + dy) / iH) / 2;
      } else if (h === "ne") {
        scaleFactor = ((iW + dx) / iW + (iH - dy) / iH) / 2;
      } else if (h === "nw") {
        scaleFactor = ((iW - dx) / iW + (iH - dy) / iH) / 2;
      }

      // 限制最小缩放（图片至少 10px）
      const minFactor = 10 / Math.min(iW, iH);
      scaleFactor = Math.max(minFactor, scaleFactor);

      // 新的图片像素尺寸（等比）
      const newW = iW * scaleFactor;
      const newH = iH * scaleFactor;

      // 根据手柄方向确定锚点，计算新的图片左上角位置（像素）
      let newL = iL;
      let newT = iT;

      // 水平方向锚点
      if (h === "e" || h === "ne" || h === "se") {
        newL = iL;                   // 左边固定
      } else if (h === "w" || h === "nw" || h === "sw") {
        newL = iL + iW - newW;       // 右边固定
      } else {
        newL = iL + (iW - newW) / 2; // 上下边手柄：水平中心固定
      }

      // 垂直方向锚点
      if (h === "s" || h === "se" || h === "sw") {
        newT = iT;                   // 上边固定
      } else if (h === "n" || h === "ne" || h === "nw") {
        newT = iT + iH - newH;       // 下边固定
      } else {
        newT = iT + (iH - newH) / 2; // 左右边手柄：垂直中心固定
      }

      // 从新的图片像素宽度反推 userScale
      // renderW = imgW * baseScale * userScale
      // => userScale = renderW / (imgW * baseScale) = newW / initRenderW * initScale
      const newScale = (newW / iW) * sd.initScale;

      // 从图片中心像素位置反推 offsetX/offsetY（百分比，相对图框）
      // imgCenterX = slotPxW/2 + offsetX/100 * slotPxW
      // => offsetX = (imgCenterX - slotPxW/2) / slotPxW * 100
      const newCenterX = newL + newW / 2;
      const newCenterY = newT + newH / 2;
      const newOffsetX = (newCenterX - sd.slotPxW / 2) / sd.slotPxW * 100;
       const newOffsetY = (newCenterY - sd.slotPxH / 2) / sd.slotPxH * 100;
      console.log('[ImgScale] iW:', iW, 'iH:', iH, 'dx:', dx, 'dy:', dy, 'scaleFactor:', scaleFactor, 'newScale:', newScale, 'initScale:', sd.initScale, 'zoom:', sd.zoom);
      updateSlot(sd.slotId, {
        scale: round(newScale, 4),
        offsetX: round(newOffsetX, 3),
        offsetY: round(newOffsetY, 3),
      });
    };
    const handleScaleMouseUp = () => {
      imgScaleDragRef.current.active = false;
    };
    window.addEventListener("mousemove", handleScaleMouseMove);
    window.addEventListener("mouseup", handleScaleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleScaleMouseMove);
      window.removeEventListener("mouseup", handleScaleMouseUp);
    };
   }, [imageEditSlotId, updateSlot]);

  // ─── 图片编辑模式：原生 wheel 事件（passive:false）───────────────────────────────
  // React 17+ 把 onWheel 注册为 passive，导致 preventDefault() 无效
  // 必须用原生 addEventListener({ passive: false }) 才能阻止页面滚动
  useEffect(() => {
    if (!imageEditSlotId || !canvasRef.current) return;
    const canvas = canvasRef.current;
    // 找到当前编辑的 slot
    const handleNativeWheel = (e: WheelEvent) => {
      // 只处理画布内的滚轮事件
      if (!canvas.contains(e.target as Node)) return;
      const editId = imageEditSlotIdRef.current;
      if (!editId) return;
      e.preventDefault();
      e.stopPropagation();
      const slot = slotsRef.current.find((s) => s.id === editId);
      if (!slot) return;
      if (e.shiftKey) {
        // Shift+滚轮 = 旋转（每格 3°）
        const delta = e.deltaY > 0 ? 3 : -3;
        const newRotation = ((slot.rotation ?? 0) + delta + 180) % 360 - 180;
        updateSlotRef.current(editId, { rotation: round(newRotation, 1) });
      } else {
        // 普通滚轮 = 缩放（完全自由，无上下限制）
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const newScale = Math.max(0.01, (slot.scale || 1) + delta);
        updateSlotRef.current(editId, { scale: round(newScale, 3) });
      }
    };
    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
    };
  }, [imageEditSlotId]);

  // ─── 视口平移事件监听（空格+拖动 / 中键拖动） ─────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setIsSpaceDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceDown(false);
        if (panDragRef.current.active) {
          panDragRef.current.active = false;
          setIsPanning(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handlePanMouseMove = (e: MouseEvent) => {
      if (!panDragRef.current.active) return;
      const scroll = scrollRef.current;
      if (!scroll) return;
      const dx = e.clientX - panDragRef.current.startClientX;
      const dy = e.clientY - panDragRef.current.startClientY;
      scroll.scrollLeft = panDragRef.current.initScrollLeft - dx;
      scroll.scrollTop = panDragRef.current.initScrollTop - dy;
    };
    const handlePanMouseUp = () => {
      if (panDragRef.current.active) {
        panDragRef.current.active = false;
        setIsPanning(false);
      }
    };
    window.addEventListener("mousemove", handlePanMouseMove);
    window.addEventListener("mouseup", handlePanMouseUp);
    return () => {
      window.removeEventListener("mousemove", handlePanMouseMove);
      window.removeEventListener("mouseup", handlePanMouseUp);
    };
  }, []);
  // ─── 图片缩放手柄鼠标按下（图片编辑模式下） ─────────────────────────
  const handleImgScaleMouseDown = useCallback(
    (e: React.MouseEvent, slot: Slot, handle: ResizeHandle, imgRect: { left: number; top: number; renderW: number; renderH: number; baseScale: number }) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      console.log('[ImgScaleDown] handle:', handle, 'clientX:', e.clientX, 'clientY:', e.clientY, 'imgRect:', JSON.stringify(imgRect));
      const slotPxW = (slot.w / 100) * displayW;
      const slotPxH = (slot.h / 100) * displayH;
      imgScaleDragRef.current = {
        active: true,
        slotId: slot.id,
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        initScale: slot.scale ?? 1,
        initOffsetX: slot.offsetX ?? 0,
        initOffsetY: slot.offsetY ?? 0,
        slotPxW,
        slotPxH,
        initImgLeft: imgRect.left,
        initImgTop: imgRect.top,
        initRenderW: imgRect.renderW,
        initRenderH: imgRect.renderH,
        baseScale: imgRect.baseScale,
        anchorImgX: 0,
        anchorImgY: 0,
        anchorSlotX: 0,
        anchorSlotY: 0,
        zoom,
      };
    },
    [displayW, displayH, zoom]
  );

  // ─── 旋转手柄鼠标按下 ────────────────────────────────
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
  // ─── 缩放手柄鼠标按下 ──────────────────────────────────────
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

  // ─── Overlay 鼠标事件 ────────────────────────────────────────────────
  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent, overlay: OverlayItem) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      selectOverlay(overlay.id);
      overlayDragRef.current = {
        active: true,
        type: "move",
        overlayId: overlay.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        initX: overlay.x,
        initY: overlay.y,
        initW: overlay.w,
        initH: overlay.h,
      };
    },
    [selectOverlay]
  );

  const handleOverlayResizeMouseDown = useCallback(
    (e: React.MouseEvent, overlay: OverlayItem, handle: ResizeHandle) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      overlayDragRef.current = {
        active: true,
        type: "resize",
        overlayId: overlay.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        initX: overlay.x,
        initY: overlay.y,
        initW: overlay.w,
        initH: overlay.h,
        handle,
      };
    },
    []
  );

  // Overlay 鼠标移动和释放
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const od = overlayDragRef.current;
      if (!od.active) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dxPct = ((e.clientX - od.startClientX) / rect.width) * 100;
      const dyPct = ((e.clientY - od.startClientY) / rect.height) * 100;

      if (od.type === "move") {
        const newX = clamp(od.initX + dxPct, 0, 100 - od.initW);
        const newY = clamp(od.initY + dyPct, 0, 100 - od.initH);
        updateOverlay(od.overlayId, { x: round(newX, 2), y: round(newY, 2) });
      } else if (od.type === "resize" && od.handle) {
        const h = od.handle;
        let nx = od.initX, ny = od.initY, nw = od.initW, nh = od.initH;
        if (h.includes("e")) nw = Math.max(2, od.initW + dxPct);
        if (h.includes("s")) nh = Math.max(2, od.initH + dyPct);
        if (h.includes("w")) { const newW = Math.max(2, od.initW - dxPct); nx = od.initX + (od.initW - newW); nw = newW; }
        if (h.includes("n")) { const newH = Math.max(2, od.initH - dyPct); ny = od.initY + (od.initH - newH); nh = newH; }
        updateOverlay(od.overlayId, { x: round(clamp(nx, 0, 100), 2), y: round(clamp(ny, 0, 100), 2), w: round(nw, 2), h: round(nh, 2) });
      }
    };
    const handleMouseUp = () => {
      overlayDragRef.current.active = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [updateOverlay]);

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
        cursor: isPanning ? "grabbing" : isSpaceDown ? "grab" : undefined,
      }}
      onWheel={handleWheel}
      onMouseDown={(e) => {
        // 空格+左键或中键拖动：平移视口
        if ((isSpaceDown && e.button === 0) || e.button === 1) {
          e.preventDefault();
          const scroll = scrollRef.current;
          if (!scroll) return;
          panDragRef.current = {
            active: true,
            startClientX: e.clientX,
            startClientY: e.clientY,
            initScrollLeft: scroll.scrollLeft,
            initScrollTop: scroll.scrollTop,
          };
          setIsPanning(true);
        }
      }}
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
          "relative flex-shrink-0 select-none",
          mode === "draw" ? "cursor-crosshair" : "cursor-default"
        )}
        style={{
          width: displayW,
          height: displayH,
          boxShadow: "0 12px 60px oklch(0 0 0 / 0.7), 0 4px 16px oklch(0 0 0 / 0.5)",
          outline: "1px solid oklch(1 0 0 / 0.1)",
          overflow: "hidden",
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
            canvasW={displayW}
            canvasH={displayH}
            onMouseDown={handleSlotMouseDown}
            onDoubleClick={handleSlotDoubleClick}
            onWheel={handleSlotWheel}
            onResizeMouseDown={handleResizeMouseDown}
            onRotateMouseDown={handleRotateMouseDown}
            onImgScaleMouseDown={handleImgScaleMouseDown}
            onDrop={handleSlotDrop}
            onDragOver={handleSlotDragOver}
            onUnfill={() => unfillSlot(slot.id)}
            updateSlot={updateSlot}
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

        {/* 装饰层（永远在 Slot 上方） */}
        {overlays.map((overlay) => (
          <OverlayRenderer
            key={overlay.id}
            overlay={overlay}
            isSelected={overlay.id === selectedOverlayId}
            zoom={zoom}
            onMouseDown={handleOverlayMouseDown}
            onResizeMouseDown={handleOverlayResizeMouseDown}
            onDelete={() => deleteOverlay(overlay.id)}
          />
        ))}

        {/* 编辑模式下的图框外区域遮罩（让用户清楚看到图框边界） */}
        {imageEditSlotId && (() => {
          const editSlot = slots.find((s) => s.id === imageEditSlotId);
          if (!editSlot) return null;
          // 用四个半透明覆盖层模拟图框外区域变暗
          const { x, y, w, h } = editSlot;
          return (
            <>
              {/* 上方 */}
              {y > 0 && <div className="absolute pointer-events-none" style={{ left: 0, top: 0, width: "100%", height: `${y}%`, background: "oklch(0 0 0 / 0.45)", zIndex: 25 }} />}
              {/* 下方 */}
              {(y + h) < 100 && <div className="absolute pointer-events-none" style={{ left: 0, top: `${y + h}%`, width: "100%", bottom: 0, height: `${100 - y - h}%`, background: "oklch(0 0 0 / 0.45)", zIndex: 25 }} />}
              {/* 左方 */}
              {x > 0 && <div className="absolute pointer-events-none" style={{ left: 0, top: `${y}%`, width: `${x}%`, height: `${h}%`, background: "oklch(0 0 0 / 0.45)", zIndex: 25 }} />}
              {/* 右方 */}
              {(x + w) < 100 && <div className="absolute pointer-events-none" style={{ left: `${x + w}%`, top: `${y}%`, width: `${100 - x - w}%`, height: `${h}%`, background: "oklch(0 0 0 / 0.45)", zIndex: 25 }} />}
              {/* 图框边界轮廓线 */}
              {(() => {
                const editPxW = (w / 100) * displayW;
                const editPxH = (h / 100) * displayH;
                const editShort = Math.min(editPxW, editPxH);
                const editRadiusPx = editSlot.borderRadius && editSlot.borderRadius > 0
                  ? Math.round((editSlot.borderRadius / 100) * editShort)
                  : 0;
                return (
                  <>
                    {/* 图框轮廓层：高 z-index 确保始终显示在图片上方 */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        width: `${w}%`,
                        height: `${h}%`,
                        border: "2px dashed oklch(0.65 0.22 220 / 0.95)",  // 蓝色虚线，与图片橙色区分
                        zIndex: 35,  // 高于 slot div 的 30，始终在图片上方
                        boxShadow: "0 0 0 1px oklch(0.65 0.22 220 / 0.3), inset 0 0 0 1px oklch(0.65 0.22 220 / 0.15)",
                        borderRadius: editRadiusPx > 0 ? `${editRadiusPx}px` : undefined,
                      }}
                    />
                    {/* 图框标签：左上角，高于图片 */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        zIndex: 36,
                        transform: "translate(4px, 4px)",
                        background: "oklch(0.30 0.18 220 / 0.95)",
                        border: "1px solid oklch(0.65 0.22 220 / 0.6)",
                        borderRadius: 3,
                        padding: "1px 6px",
                        fontSize: 9,
                        color: "oklch(0.88 0.12 220)",
                        fontFamily: "system-ui, sans-serif",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      图框
                    </div>
                  </>
                );
              })()}
            </>
          );
        })()}

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
            图片调节模式 · 拖动平移 · 橙色手柄缩放 · 滚轮缩放 · Shift+滚轮旋转 · Esc 退出
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
  canvasW: number;
  canvasH: number;
  onMouseDown: (e: React.MouseEvent, slot: Slot) => void;
  onDoubleClick: (e: React.MouseEvent, slot: Slot) => void;
  onWheel: (e: React.WheelEvent, slot: Slot) => void;
  onResizeMouseDown: (e: React.MouseEvent, slot: Slot, handle: ResizeHandle) => void;
  onRotateMouseDown: (e: React.MouseEvent, slot: Slot) => void;
  onImgScaleMouseDown: (e: React.MouseEvent, slot: Slot, handle: ResizeHandle, imgRect: { left: number; top: number; renderW: number; renderH: number; baseScale: number }) => void;
  onDrop: (e: React.DragEvent, slotId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onUnfill: () => void;
  updateSlot: (id: string, patch: Partial<Slot>) => void;
}
function SlotRenderer({
  slot,
  asset,
  isSelected,
  isMultiSelected,
  isImageEditMode,
  zoom,
  canvasW,
  canvasH,
  onMouseDown,
  onDoubleClick,
  onWheel,
  onResizeMouseDown,
  onRotateMouseDown,
  onImgScaleMouseDown,
  onDrop,
  onDragOver,
  onUnfill,
  updateSlot,
}: SlotRendererProps) {
  const hasFill = !!asset;
  // 图片实际位置和尺寸（由 AspectFillImage 回调更新）
  // 同时用 ref 存储，确保 onMouseDown 闭包中读到最新值（避免 stale closure）
  const [imgRect, setImgRect] = React.useState<{ left: number; top: number; renderW: number; renderH: number; baseScale: number } | null>(null);
  const imgRectRef = React.useRef<{ left: number; top: number; renderW: number; renderH: number; baseScale: number } | null>(null);
  const handleImgRectUpdate = React.useCallback((rect: { left: number; top: number; renderW: number; renderH: number; baseScale: number }) => {
    imgRectRef.current = rect;
    setImgRect(rect);
  }, []);
  // 圆角像素値：基于短边计算，确保四角均匀
  // slot.borderRadius 是 0~50 的百分比，转换为短边的对应像素值
  const slotPxW = (slot.w / 100) * canvasW;
  const slotPxH = (slot.h / 100) * canvasH;
  const shortSide = Math.min(slotPxW, slotPxH);
  const radiusPx = slot.borderRadius && slot.borderRadius > 0
    ? Math.round((slot.borderRadius / 100) * shortSide)
    : 0;

  // 边框颜色：图片调节模式=蓝色虚线（图框），选中=蓝色，多选=橙色，空框=虚线蓝
  const outlineStyle = isImageEditMode
    ? "2px dashed oklch(0.55 0.22 220)"  // 图框：蓝色虚线（裁切窗口）
    : isSelected
    ? "2px solid oklch(0.58 0.22 264)"
    : isMultiSelected
    ? "2px solid oklch(0.72 0.16 55)"
    : hasFill
    ? "none"
    : "1.5px dashed oklch(0.58 0.22 264 / 0.55)";

  const boxShadowStyle = isImageEditMode
    ? "0 0 0 2px oklch(0.55 0.22 220 / 0.5), 0 0 16px oklch(0.55 0.22 220 / 0.2)"  // 图框蓝色光晕
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
        // 编辑模式下需要更高 z-index 确保图片显示在其他图框上方
        zIndex: isImageEditMode ? 30 : undefined,
        transition: "box-shadow 0.15s ease, outline 0.15s ease",
        // 正常模式 overflow:hidden 裁剪超出图框的图片
        // 编辑模式 overflow:visible 显示完整图片边界
        overflow: isImageEditMode ? "visible" : "hidden",
        // 圆角：基于短边像素值，四角均匀
        borderRadius: radiusPx > 0 ? `${radiusPx}px` : undefined,
      }}
      onMouseDown={(e) => onMouseDown(e, slot)}
      onDoubleClick={(e) => onDoubleClick(e, slot)}
      onWheel={(e) => onWheel(e, slot)}
      onDrop={(e) => onDrop(e, slot.id)}
      onDragOver={onDragOver}
    >
      {/* 图片填充：直接相对 slot div 定位，无中间层 */}
      {asset && (
        <>
          <AspectFillImage asset={asset} slot={slot} canvasW={canvasW} canvasH={canvasH} isEditMode={isImageEditMode} onImgRect={isImageEditMode ? handleImgRectUpdate : undefined} />
          {/* 图片调节模式标识角标：图框标签（蓝色） */}
          {isImageEditMode && (
            <div
              className="absolute top-1 left-1 z-40 pointer-events-none"
              style={{
                background: "oklch(0.35 0.18 220 / 0.92)",
                border: "1px solid oklch(0.55 0.22 220 / 0.6)",
                borderRadius: 3,
                padding: "1px 6px",
                fontSize: 9,
                color: "oklch(0.85 0.12 220)",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              图框
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
        </>
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

      {/* 图片调节模式：图片缩放手柄（显示在图片实际边界，橙色） */}
      {isImageEditMode && asset && imgRect && imgRect.renderW > 0 && RESIZE_HANDLES.map((handle) => {
        // 根据手柄方向计算控制点在图片实际边界上的位置
        const HSIZE = 10;
        const half = HSIZE / 2;
        const { left: iL, top: iT, renderW: iW, renderH: iH } = imgRect;
        const handlePos: React.CSSProperties = (() => {
          switch (handle) {
            case "nw": return { left: iL - half, top: iT - half, cursor: "nw-resize" };
            case "n":  return { left: iL + iW / 2 - half, top: iT - half, cursor: "n-resize" };
            case "ne": return { left: iL + iW - half, top: iT - half, cursor: "ne-resize" };
            case "w":  return { left: iL - half, top: iT + iH / 2 - half, cursor: "w-resize" };
            case "e":  return { left: iL + iW - half, top: iT + iH / 2 - half, cursor: "e-resize" };
            case "sw": return { left: iL - half, top: iT + iH - half, cursor: "sw-resize" };
            case "s":  return { left: iL + iW / 2 - half, top: iT + iH - half, cursor: "s-resize" };
            case "se": return { left: iL + iW - half, top: iT + iH - half, cursor: "se-resize" };
          }
        })();
        return (
          <div
            key={`img-scale-${handle}`}
            className="absolute z-50"
            style={{
              position: "absolute",
              ...handlePos,
              width: HSIZE,
              height: HSIZE,
              backgroundColor: "oklch(0.72 0.20 55)",
              border: "1.5px solid white",
              borderRadius: 2,
              boxShadow: "0 0 0 1px oklch(0.72 0.20 55 / 0.5)",
            }}
            onMouseDown={(e) => { e.stopPropagation(); const r = imgRectRef.current ?? imgRect; if (r) onImgScaleMouseDown(e, slot, handle, r); }}
            title="拖动缩放图片"
          />
        );
      })}

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
// ─── 图片渲染——标准 non-destructive cover crop 模型────
//
// 设计原则：
//   1. 图片始终保留完整原图，不允许破坏式裁切
//   2. 展示状态：图片按像素级 cover 规则等比缩放并铺满图框
//   3. 图框本质是 crop window / viewport，超出图框的部分仅隐藏
//   4. 编辑状态：进入 pan + zoom 模式，显示完整图片边界（overflow:visible）
//   5. 用户通过拖动和缩放图片来调整最终取景
//   6. 最终保存的是 transform 参数，不是生成裁切后的新图
//
// 坐标系（全部为屏幕像素，与图框 div 坐标系一致）：
//   slotPxW = slot.w/100 * canvasW  （canvasW = canvas.logicalWidth * zoom）
//   slotPxH = slot.h/100 * canvasH
//   coverScale = max(slotPxW / imgNW, slotPxH / imgNH)
//   renderW = imgNW * coverScale * userScale
//   renderH = imgNH * coverScale * userScale
//   imgLeft = slotPxW/2 + offsetX/100*slotPxW - renderW/2
//   imgTop  = slotPxH/2 + offsetY/100*slotPxH - renderH/2
//
// 关键约束：
//   - img 的 width/height 必须是像素值，绝不使用 "100%" / "auto"
//   - img 必须设置 maxWidth:none / maxHeight:none 覆盖 Tailwind preflight
//   - 图片未加载时（imgNW=0）用 visibility:hidden 隐藏，不渲染任何尺寸
//   - 编辑态不依赖 overflow:hidden 做裁切，控制点显示在图片实际边界
function AspectFillImage({
  asset,
  slot,
  canvasW,
  canvasH,
  isEditMode,
  onImgRect,
}: {
  asset: import("@/lib/types").Asset;
  slot: Slot;
  canvasW: number;  // 屏幕像素宽（canvas.logicalWidth * zoom）
  canvasH: number;  // 屏幕像素高（canvas.logicalHeight * zoom）
  isEditMode: boolean;
  onImgRect?: (rect: { left: number; top: number; renderW: number; renderH: number; baseScale: number }) => void;
}) {
  // ── 追踪图片真实尺寸（防止 asset.naturalWidth/Height 为 0）──────────────
  const [loadedSize, setLoadedSize] = React.useState<{ w: number; h: number } | null>(
    asset.naturalWidth > 0 && asset.naturalHeight > 0
      ? { w: asset.naturalWidth, h: asset.naturalHeight }
      : null
  );
  // asset 切换时重置
  const prevAssetId = React.useRef<string>(asset.id);
  if (prevAssetId.current !== asset.id) {
    prevAssetId.current = asset.id;
    setLoadedSize(
      asset.naturalWidth > 0 && asset.naturalHeight > 0
        ? { w: asset.naturalWidth, h: asset.naturalHeight }
        : null
    );
  }

  const offsetX  = slot.offsetX  ?? 0;  // 图片中心相对图框中心的水平偏移（图框宽度的百分比）
  const offsetY  = slot.offsetY  ?? 0;  // 图片中心相对图框中心的垂直偏移（图框高度的百分比）
  const userScale = slot.scale   ?? 1;  // 用户额外缩放（1.0 = 刚好 cover）
  const rotation  = slot.rotation ?? 0;

  // ── 图框屏幕像素尺寸（与图框 div 的 CSS 尺寸完全一致）──────────────────
  const slotPxW = (slot.w / 100) * canvasW;
  const slotPxH = (slot.h / 100) * canvasH;

  // ── 图片原始像素尺寸（优先用 asset 存储值，fallback 用 onLoad 获取值）──
  const imgNW = asset.naturalWidth  > 0 ? asset.naturalWidth  : (loadedSize?.w ?? 0);
  const imgNH = asset.naturalHeight > 0 ? asset.naturalHeight : (loadedSize?.h ?? 0);

  // ── 像素级 cover 公式 ─────────────────────────────────────────────────────
  // coverScale = max(slotPxW/imgNW, slotPxH/imgNH)
  // 保证图片两个方向都不小于图框（铺满图框，超出部分被 overflow:hidden 裁切）
  // 注意：coverScale 是「屏幕像素 / 原始像素」的比值，不受 zoom 影响（两者同比缩放）
  let coverScale = 1;
  if (imgNW > 0 && imgNH > 0 && slotPxW > 0 && slotPxH > 0) {
    coverScale = Math.max(slotPxW / imgNW, slotPxH / imgNH);
  }

  // 最终渲染尺寸（屏幕像素）
  const renderW = imgNW * coverScale * userScale;
  const renderH = imgNH * coverScale * userScale;

  // ── 中心对中心定位 ────────────────────────────────────────────────────────
  // 图片中心 = 图框中心 + 偏移量
  // imgLeft = (slotPxW/2 + offsetX/100*slotPxW) - renderW/2
  const imgCenterX = slotPxW / 2 + (offsetX / 100) * slotPxW;
  const imgCenterY = slotPxH / 2 + (offsetY / 100) * slotPxH;
  const imgLeft    = imgCenterX - renderW / 2;
  const imgTop     = imgCenterY - renderH / 2;

  // ── 通知父组件图片实际位置（用于编辑态控制点定位）────────────────────────
  React.useEffect(() => {
    if (isEditMode && onImgRect && renderW > 0 && renderH > 0) {
      onImgRect({ left: imgLeft, top: imgTop, renderW, renderH, baseScale: coverScale });
    }
  }, [isEditMode, onImgRect, imgLeft, imgTop, renderW, renderH, coverScale]);

  // 图片未加载时隐藏（不用 width:100%/height:auto，避免 CSS 默认行为干扰）
  const notReady = imgNW === 0 || imgNH === 0;

  // 编辑模式橙色虚线边框
  const editOutlineStyle = isEditMode ? {
    outline: "2px dashed oklch(0.75 0.20 55 / 0.95)",
    outlineOffset: 2,
  } : {};

  return (
    <>
      <img
        src={asset.dataUrl}
        alt={asset.name}
        draggable={false}
        onLoad={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          if (el.naturalWidth > 0 && el.naturalHeight > 0) {
            setLoadedSize({ w: el.naturalWidth, h: el.naturalHeight });
          }
        }}
        style={{
          // ── 像素级绝对定位，完全脱离 CSS 流 ──────────────────────────────
          position: "absolute",
          left: notReady ? 0 : imgLeft,
          top:  notReady ? 0 : imgTop,
          // 严格用像素值，绝不用 "100%" 或 "auto"
          // 否则 Tailwind preflight 的 max-width:100%/height:auto 会干扰尺寸
          width:  notReady ? 0 : renderW,
          height: notReady ? 0 : renderH,
          // 覆盖 Tailwind preflight：img { max-width:100%; height:auto }
          // 这两条规则优先级低于 inline style，但显式声明更安全
          maxWidth:  "none",
          maxHeight: "none",
          // 图片未加载时完全隐藏，避免 0 尺寸时的布局抖动
          visibility: notReady ? "hidden" : "visible",
          // 旋转（以图片自身中心为原点）
          transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: "center center",
          userSelect: "none",
          pointerEvents: "none",
          // 编辑态橙色虚线边框
          ...editOutlineStyle,
        }}
      />
      {/* 编辑模式：图片尺寸标签（橙色，显示在图片右下角） */}
      {isEditMode && !notReady && (
        <div
          className="pointer-events-none"
          style={{
            position: "absolute",
            left: imgLeft + renderW - 2,
            top:  imgTop  + renderH - 2,
            transform: "translate(-100%, -100%)",
            background: "oklch(0.40 0.20 55 / 0.92)",
            border: "1px solid oklch(0.75 0.20 55 / 0.6)",
            borderRadius: 3,
            padding: "1px 6px",
            fontSize: 9,
            color: "oklch(0.92 0.10 55)",
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            letterSpacing: "0.05em",
            zIndex: 45,
            whiteSpace: "nowrap",
          }}
        >
          {Math.round(renderW / coverScale)} × {Math.round(renderH / coverScale)} px
        </div>
      )}
    </>
  );
}

// ─── OverlayRenderer 组件 ─────────────────────────────────────────────────
function OverlayRenderer({
  overlay,
  isSelected,
  zoom,
  onMouseDown,
  onResizeMouseDown,
  onDelete,
}: {
  overlay: OverlayItem;
  isSelected: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent, overlay: OverlayItem) => void;
  onResizeMouseDown: (e: React.MouseEvent, overlay: OverlayItem, handle: ResizeHandle) => void;
  onDelete: () => void;
}) {
  const HANDLE_SIZE = Math.max(6, Math.min(10, 8 / zoom));
  const resizeHandles: ResizeHandle[] = ["nw", "ne", "se", "sw", "n", "s", "e", "w"];

  return (
    <div
      data-overlay={overlay.id}
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        width: `${overlay.w}%`,
        height: `${overlay.h}%`,
        opacity: overlay.opacity,
        transform: overlay.rotation ? `rotate(${overlay.rotation}deg)` : undefined,
        transformOrigin: "center center",
        cursor: "move",
        zIndex: 40,
        outline: isSelected ? "2px solid oklch(0.72 0.22 55)" : "none",
        outlineOffset: 1,
        boxShadow: isSelected ? "0 0 0 1px oklch(0.72 0.22 55 / 0.3)" : "none",
        pointerEvents: "all",
        userSelect: "none",
      }}
      onMouseDown={(e) => onMouseDown(e, overlay)}
    >
      {/* 图片 */}
      <img
        src={overlay.dataUrl}
        alt={overlay.label || "装饰层"}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      {/* 选中时的缩放手柄 */}
      {isSelected && resizeHandles.map((handle) => (
        <div
          key={handle}
          style={{
            position: "absolute",
            ...getHandleStyle(handle),
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            backgroundColor: "oklch(0.72 0.22 55)",
            border: "1.5px solid white",
            borderRadius: 2,
            zIndex: 50,
            cursor: getResizeCursor(handle),
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeMouseDown(e, overlay, handle);
          }}
        />
      ))}

      {/* 选中时的删除按钮 */}
      {isSelected && (
        <button
          style={{
            position: "absolute",
            top: -20,
            right: -4,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "oklch(0.62 0.22 25 / 0.92)",
            border: "1px solid oklch(1 0 0 / 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 55,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="删除装饰层"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* 选中时的标签 */}
      {isSelected && overlay.label && (
        <div
          style={{
            position: "absolute",
            top: -20,
            left: 0,
            background: "oklch(0.15 0.02 264 / 0.9)",
            border: "1px solid oklch(0.72 0.22 55 / 0.4)",
            borderRadius: 3,
            padding: "1px 5px",
            fontSize: 9,
            color: "oklch(0.85 0.12 55)",
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {overlay.label}
        </div>
      )}
    </div>
  );
}

function getResizeCursor(handle: ResizeHandle): string {
  const map: Record<ResizeHandle, string> = {
    nw: "nw-resize", ne: "ne-resize", se: "se-resize", sw: "sw-resize",
    n: "n-resize", s: "s-resize", e: "e-resize", w: "w-resize",
  };
  return map[handle] ?? "pointer";
}
