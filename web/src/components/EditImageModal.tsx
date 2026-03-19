// ============================================================
// 奇妙奇遇光影集 排版 Studio — 图片编辑界面
// Design: 专业暗夜工作台 — PS 风格编辑工具
// 功能: 裁剪选项卡（可拖动裁剪框）+ 旋转选项卡（精细角度控制）
//       确认后更新原始 Asset 的 croppedDataUrl 和 cropRect
// ============================================================
import React, { useRef, useEffect, useState, useCallback } from "react";
import { X, Check, RotateCcw, RotateCw, Crop, RefreshCw } from "lucide-react";
import type { Asset, CropRect } from "@/lib/types";

interface CropBox {
  x: number; // 相对图片显示区域的百分比 0-100
  y: number;
  w: number;
  h: number;
}

interface EditImageModalProps {
  asset: Asset;
  onConfirm: (updatedAsset: Asset) => void;
  onCancel: () => void;
}

function cropRectToBox(cropRect: CropRect, naturalW: number, naturalH: number): CropBox {
  return {
    x: (cropRect.x / naturalW) * 100,
    y: (cropRect.y / naturalH) * 100,
    w: (cropRect.width / naturalW) * 100,
    h: (cropRect.height / naturalH) * 100,
  };
}

type DragHandle =
  | "tl" | "tc" | "tr"
  | "ml" | "mr"
  | "bl" | "bc" | "br"
  | "move"
  | null;

const MIN_SIZE = 5;

// ─── 旋转选项卡 ─────────────────────────────────────────────────────────
function RotateTab({
  asset,
  onConfirm,
  onCancel,
}: {
  asset: Asset;
  onConfirm: (updated: Asset) => void;
  onCancel: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const clampRotation = (v: number) => Math.max(-180, Math.min(180, v));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    setRotation((prev) => clampRotation(prev + (e.deltaY > 0 ? step : -step)));
  }, []);

  const handleInputWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    setRotation((prev) => clampRotation(prev + (e.deltaY > 0 ? step : -step)));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (rotation === 0) {
      // 无旋转，直接返回原始 asset
      onConfirm(asset);
      return;
    }
    const img = new Image();
    img.src = asset.dataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      if (img.complete) resolve();
    });
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const outW = Math.round(asset.naturalWidth * cos + asset.naturalHeight * sin);
    const outH = Math.round(asset.naturalWidth * sin + asset.naturalHeight * cos);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -asset.naturalWidth / 2, -asset.naturalHeight / 2);
    const croppedDataUrl = canvas.toDataURL("image/png", 1.0);
    const updatedAsset: Asset = {
      ...asset,
      croppedDataUrl,
      cropRect: { x: 0, y: 0, width: outW, height: outH },
    };
    onConfirm(updatedAsset);
  }, [asset, rotation, onConfirm]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleConfirm();
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleConfirm, onCancel]);

  const previewStyle: React.CSSProperties = {
    transform: `rotate(${rotation}deg)`,
    transition: "transform 0.1s ease",
    maxWidth: "80%",
    maxHeight: "80%",
    objectFit: "contain",
    userSelect: "none",
    pointerEvents: "none",
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 预览区 */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden select-none"
        onWheel={handleWheel}
        style={{ cursor: "default" }}
      >
        <img
          src={asset.dataUrl}
          alt={asset.name}
          draggable={false}
          style={previewStyle}
        />
      </div>

      {/* 旋转控制区 */}
      <div
        className="flex-shrink-0 px-8 py-5"
        style={{
          background: "oklch(0.12 0.015 260 / 0.95)",
          borderTop: "1px solid oklch(1 0 0 / 0.08)",
        }}
      >
        <div className="flex items-center gap-4 mb-4">
          {/* 左旋 90° */}
          <button
            onClick={() => setRotation((p) => clampRotation(p - 90))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all hover:opacity-80"
            style={{ background: "oklch(0.20 0.015 260)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.75 0.12 200)" }}
          >
            <RotateCcw size={14} />
            左旋 90°
          </button>
          {/* 右旋 90° */}
          <button
            onClick={() => setRotation((p) => clampRotation(p + 90))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all hover:opacity-80"
            style={{ background: "oklch(0.20 0.015 260)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.75 0.12 200)" }}
          >
            <RotateCw size={14} />
            右旋 90°
          </button>
          {/* 重置 */}
          <button
            onClick={() => setRotation(0)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all hover:opacity-80"
            style={{ background: "oklch(0.20 0.015 260)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.65 0.01 260)" }}
          >
            <RefreshCw size={14} />
            重置
          </button>
          <div className="flex-1" />
          {/* 角度数字输入 */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "oklch(0.55 0.015 260)" }}>角度</span>
            <input
              ref={inputRef}
              type="number"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) setRotation(clampRotation(v));
              }}
              onWheel={handleInputWheel}
              className="px-2 py-1 rounded text-sm text-right"
              style={{
                width: 72,
                background: "oklch(0.20 0.015 260)",
                border: "1px solid oklch(0.58 0.22 264 / 0.5)",
                color: "oklch(0.92 0.008 260)",
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
              }}
            />
            <span className="text-xs" style={{ color: "oklch(0.55 0.015 260)" }}>°</span>
          </div>
        </div>

        {/* 精细滑块 */}
        <div className="flex items-center gap-3">
          <span className="text-xs w-8 text-right" style={{ color: "oklch(0.45 0.01 260)", fontFamily: "monospace" }}>-180°</span>
          <input
            type="range"
            min={-180}
            max={180}
            step={0.5}
            value={rotation}
            onChange={(e) => setRotation(parseFloat(e.target.value))}
            className="flex-1"
            style={{ accentColor: "oklch(0.58 0.22 264)" }}
          />
          <span className="text-xs w-8" style={{ color: "oklch(0.45 0.01 260)", fontFamily: "monospace" }}>180°</span>
          <span
            className="text-sm font-bold w-16 text-center"
            style={{ color: "oklch(0.72 0.12 264)", fontFamily: "'JetBrains Mono', monospace" }}
          >
            {rotation > 0 ? "+" : ""}{rotation.toFixed(1)}°
          </span>
        </div>
        <div className="text-xs text-center mt-2" style={{ color: "oklch(0.38 0.01 260)" }}>
          滚轮微调（Shift+滚轮 = 5°步进）· Enter 确认 · Esc 取消
        </div>
      </div>
    </div>
  );
}

// ─── 裁剪选项卡 ─────────────────────────────────────────────────────────
function CropTab({
  asset,
  onConfirm,
  onCancel,
}: {
  asset: Asset;
  onConfirm: (updated: Asset) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgRect, setImgRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [cropBox, setCropBox] = useState<CropBox>(() => {
    if (asset.cropRect) {
      return cropRectToBox(asset.cropRect, asset.naturalWidth, asset.naturalHeight);
    }
    return { x: 5, y: 5, w: 90, h: 90 };
  });
  const [cursorStyle, setCursorStyle] = useState("default");

  const dragRef = useRef<{
    handle: DragHandle;
    startX: number;
    startY: number;
    startBox: CropBox;
  } | null>(null);

  const updateImgRect = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const imgAR = asset.naturalWidth / asset.naturalHeight;
    const containerAR = containerW / containerH;
    let displayW: number, displayH: number;
    if (imgAR > containerAR) {
      displayW = containerW * 0.9;
      displayH = displayW / imgAR;
    } else {
      displayH = containerH * 0.9;
      displayW = displayH * imgAR;
    }
    setImgRect({
      x: (containerW - displayW) / 2,
      y: (containerH - displayH) / 2,
      w: displayW,
      h: displayH,
    });
  }, [asset.naturalWidth, asset.naturalHeight]);

  useEffect(() => {
    updateImgRect();
    const ro = new ResizeObserver(updateImgRect);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateImgRect]);

  const cursorMap: Record<string, string> = {
    tl: "nwse-resize", tc: "ns-resize", tr: "nesw-resize",
    ml: "ew-resize", mr: "ew-resize",
    bl: "nesw-resize", bc: "ns-resize", br: "nwse-resize",
    move: "move",
  };

  const getHandle = useCallback(
    (clientX: number, clientY: number): DragHandle => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      const cropLeft = imgRect.x + (cropBox.x / 100) * imgRect.w;
      const cropTop = imgRect.y + (cropBox.y / 100) * imgRect.h;
      const cropRight = cropLeft + (cropBox.w / 100) * imgRect.w;
      const cropBottom = cropTop + (cropBox.h / 100) * imgRect.h;
      const HIT = 12;
      const inX = relX >= cropLeft - HIT && relX <= cropRight + HIT;
      const inY = relY >= cropTop - HIT && relY <= cropBottom + HIT;
      if (!inX || !inY) return null;
      const nearL = Math.abs(relX - cropLeft) < HIT;
      const nearR = Math.abs(relX - cropRight) < HIT;
      const nearT = Math.abs(relY - cropTop) < HIT;
      const nearB = Math.abs(relY - cropBottom) < HIT;
      if (nearT && nearL) return "tl";
      if (nearT && nearR) return "tr";
      if (nearB && nearL) return "bl";
      if (nearB && nearR) return "br";
      if (nearT) return "tc";
      if (nearB) return "bc";
      if (nearL) return "ml";
      if (nearR) return "mr";
      const inside = relX > cropLeft && relX < cropRight && relY > cropTop && relY < cropBottom;
      if (inside) return "move";
      return null;
    },
    [imgRect, cropBox]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const handle = getHandle(e.clientX, e.clientY);
      if (!handle) return;
      e.preventDefault();
      dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startBox: { ...cropBox } };
    },
    [getHandle, cropBox]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) {
        const handle = getHandle(e.clientX, e.clientY);
        setCursorStyle(handle ? cursorMap[handle] || "default" : "default");
        return;
      }
      const { handle, startX, startY, startBox } = dragRef.current;
      const dx = ((e.clientX - startX) / imgRect.w) * 100;
      const dy = ((e.clientY - startY) / imgRect.h) * 100;
      setCropBox((prev) => {
        let { x, y, w, h } = startBox;
        switch (handle) {
          case "move": x = Math.max(0, Math.min(100 - w, startBox.x + dx)); y = Math.max(0, Math.min(100 - h, startBox.y + dy)); break;
          case "tl": { const nx = Math.min(startBox.x + dx, startBox.x + startBox.w - MIN_SIZE); const ny = Math.min(startBox.y + dy, startBox.y + startBox.h - MIN_SIZE); x = Math.max(0, nx); y = Math.max(0, ny); w = startBox.x + startBox.w - x; h = startBox.y + startBox.h - y; break; }
          case "tr": { w = Math.max(MIN_SIZE, startBox.w + dx); const ny = Math.min(startBox.y + dy, startBox.y + startBox.h - MIN_SIZE); y = Math.max(0, ny); h = startBox.y + startBox.h - y; break; }
          case "bl": { const nx = Math.min(startBox.x + dx, startBox.x + startBox.w - MIN_SIZE); x = Math.max(0, nx); w = startBox.x + startBox.w - x; h = Math.max(MIN_SIZE, startBox.h + dy); break; }
          case "br": w = Math.max(MIN_SIZE, startBox.w + dx); h = Math.max(MIN_SIZE, startBox.h + dy); break;
          case "tc": { const ny = Math.min(startBox.y + dy, startBox.y + startBox.h - MIN_SIZE); y = Math.max(0, ny); h = startBox.y + startBox.h - y; break; }
          case "bc": h = Math.max(MIN_SIZE, startBox.h + dy); break;
          case "ml": { const nx = Math.min(startBox.x + dx, startBox.x + startBox.w - MIN_SIZE); x = Math.max(0, nx); w = startBox.x + startBox.w - x; break; }
          case "mr": w = Math.max(MIN_SIZE, startBox.w + dx); break;
        }
        w = Math.min(w, 100 - x);
        h = Math.min(h, 100 - y);
        return { x, y, w, h };
      });
    };
    const handleMouseUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [getHandle, imgRect]);

  const handleReset = () => setCropBox({ x: 5, y: 5, w: 90, h: 90 });

  const handleConfirm = useCallback(async () => {
    const srcX = Math.round((cropBox.x / 100) * asset.naturalWidth);
    const srcY = Math.round((cropBox.y / 100) * asset.naturalHeight);
    const srcW = Math.round((cropBox.w / 100) * asset.naturalWidth);
    const srcH = Math.round((cropBox.h / 100) * asset.naturalHeight);
    const img = new Image();
    img.src = asset.dataUrl;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); if (img.complete) resolve(); });
    const canvas = document.createElement("canvas");
    canvas.width = srcW;
    canvas.height = srcH;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    const croppedDataUrl = canvas.toDataURL("image/png", 1.0);
    const cropRect: CropRect = { x: srcX, y: srcY, width: srcW, height: srcH };
    onConfirm({ ...asset, croppedDataUrl, cropRect });
  }, [asset, cropBox, onConfirm]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleConfirm();
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleConfirm, onCancel]);

  const cropPx = {
    left: imgRect.x + (cropBox.x / 100) * imgRect.w,
    top: imgRect.y + (cropBox.y / 100) * imgRect.h,
    width: (cropBox.w / 100) * imgRect.w,
    height: (cropBox.h / 100) * imgRect.h,
  };
  const handles: { id: DragHandle; style: React.CSSProperties }[] = [
    { id: "tl", style: { top: -5, left: -5, cursor: "nwse-resize" } },
    { id: "tc", style: { top: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
    { id: "tr", style: { top: -5, right: -5, cursor: "nesw-resize" } },
    { id: "ml", style: { top: "50%", left: -5, transform: "translateY(-50%)", cursor: "ew-resize" } },
    { id: "mr", style: { top: "50%", right: -5, transform: "translateY(-50%)", cursor: "ew-resize" } },
    { id: "bl", style: { bottom: -5, left: -5, cursor: "nesw-resize" } },
    { id: "bc", style: { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
    { id: "br", style: { bottom: -5, right: -5, cursor: "nwse-resize" } },
  ];
  const cropW = Math.round((cropBox.w / 100) * asset.naturalWidth);
  const cropH = Math.round((cropBox.h / 100) * asset.naturalHeight);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 裁剪区域 */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
      >
        <img
          ref={imgRef}
          src={asset.dataUrl}
          alt={asset.name}
          draggable={false}
          style={{
            position: "absolute",
            left: imgRect.x,
            top: imgRect.y,
            width: imgRect.w,
            height: imgRect.h,
            objectFit: "fill",
            userSelect: "none",
          }}
        />
        {/* 四周暗色遮罩 */}
        {[
          { left: imgRect.x, top: imgRect.y, width: imgRect.w, height: (cropBox.y / 100) * imgRect.h },
          { left: imgRect.x, top: imgRect.y + ((cropBox.y + cropBox.h) / 100) * imgRect.h, width: imgRect.w, height: imgRect.h - ((cropBox.y + cropBox.h) / 100) * imgRect.h },
          { left: imgRect.x, top: imgRect.y + (cropBox.y / 100) * imgRect.h, width: (cropBox.x / 100) * imgRect.w, height: (cropBox.h / 100) * imgRect.h },
          { left: imgRect.x + ((cropBox.x + cropBox.w) / 100) * imgRect.w, top: imgRect.y + (cropBox.y / 100) * imgRect.h, width: imgRect.w - ((cropBox.x + cropBox.w) / 100) * imgRect.w, height: (cropBox.h / 100) * imgRect.h },
        ].map((s, i) => (
          <div key={i} style={{ position: "absolute", background: "oklch(0.05 0.01 260 / 0.72)", pointerEvents: "none", ...s }} />
        ))}
        {/* 裁剪框 */}
        <div style={{ position: "absolute", left: cropPx.left, top: cropPx.top, width: cropPx.width, height: cropPx.height, border: "1.5px solid oklch(0.90 0.005 260)", boxSizing: "border-box", pointerEvents: "none" }}>
          {[1, 2].map((i) => (
            <React.Fragment key={i}>
              <div style={{ position: "absolute", left: `${(i / 3) * 100}%`, top: 0, width: "1px", height: "100%", background: "oklch(1 0 0 / 0.2)" }} />
              <div style={{ position: "absolute", top: `${(i / 3) * 100}%`, left: 0, height: "1px", width: "100%", background: "oklch(1 0 0 / 0.2)" }} />
            </React.Fragment>
          ))}
          {handles.map(({ id, style }) => (
            <div key={id} style={{ position: "absolute", width: 10, height: 10, background: "oklch(0.98 0.005 260)", border: "1.5px solid oklch(0.58 0.22 264)", borderRadius: 2, boxShadow: "0 0 4px oklch(0 0 0 / 0.5)", pointerEvents: "none", ...style }} />
          ))}
        </div>
      </div>
      {/* 底部工具栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-2.5" style={{ background: "oklch(0.12 0.015 260 / 0.95)", borderTop: "1px solid oklch(1 0 0 / 0.08)" }}>
        <div className="flex items-center gap-3">
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all hover:opacity-80" style={{ background: "oklch(0.20 0.015 260)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.65 0.01 260)" }}>
            <RotateCcw size={13} /> 重置
          </button>
          {asset.cropRect && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "oklch(0.62 0.20 45 / 0.15)", color: "oklch(0.72 0.18 45)" }}>已恢复上次裁剪</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "oklch(0.40 0.01 260)", fontFamily: "'JetBrains Mono', monospace" }}>
            原图 {asset.naturalWidth}×{asset.naturalHeight} → 裁剪后 <span style={{ color: "oklch(0.72 0.12 264)" }}>{cropW}×{cropH}</span> px
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── 主组件 EditImageModal ───────────────────────────────────────────────
export default function EditImageModal({ asset, onConfirm, onCancel }: EditImageModalProps) {
  const [activeTab, setActiveTab] = useState<"crop" | "rotate">("crop");

  const tabStyle = (tab: "crop" | "rotate"): React.CSSProperties => ({
    padding: "8px 20px",
    borderRadius: 8,
    fontSize: "0.85rem",
    fontWeight: 600,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: "pointer",
    border: "none",
    transition: "all 0.15s",
    background: activeTab === tab ? "oklch(0.58 0.22 264)" : "transparent",
    color: activeTab === tab ? "oklch(0.98 0.005 260)" : "oklch(0.55 0.015 260)",
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "oklch(0.06 0.01 260 / 0.97)" }}>
      {/* 顶部工具栏 */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{ background: "oklch(0.12 0.015 260 / 0.95)", borderBottom: "1px solid oklch(1 0 0 / 0.08)" }}
      >
        {/* 左：标题 + 文件名 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "oklch(0.58 0.22 264 / 0.15)" }}>
            <span className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 260)", fontFamily: "'Space Grotesk', sans-serif" }}>
              编辑图片
            </span>
          </div>
          <span className="text-xs" style={{ color: "oklch(0.45 0.01 260)", fontFamily: "'JetBrains Mono', monospace" }}>
            {asset.name}
          </span>
        </div>

        {/* 中：选项卡 */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "oklch(0.18 0.015 260)" }}>
          <button style={tabStyle("crop")} onClick={() => setActiveTab("crop")}>
            <span className="flex items-center gap-1.5"><Crop size={13} /> 裁剪</span>
          </button>
          <button style={tabStyle("rotate")} onClick={() => setActiveTab("rotate")}>
            <span className="flex items-center gap-1.5"><RotateCw size={13} /> 旋转</span>
          </button>
        </div>

        {/* 右：取消 + 确认 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all hover:opacity-80"
            style={{ background: "oklch(0.20 0.015 260)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.65 0.01 260)", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <X size={14} /> 取消
          </button>
          <button
            onClick={() => {
              // 触发当前选项卡的确认（通过 Enter 键事件）
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "oklch(0.58 0.22 264)", color: "oklch(0.98 0.005 260)", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <Check size={14} /> 确认
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "crop" ? (
          <CropTab asset={asset} onConfirm={onConfirm} onCancel={onCancel} />
        ) : (
          <RotateTab asset={asset} onConfirm={onConfirm} onCancel={onCancel} />
        )}
      </div>
    </div>
  );
}
