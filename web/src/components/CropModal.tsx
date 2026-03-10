// ============================================================
// 奇妙奇遇光影集 排版 Studio — 全屏裁剪界面
// Design: 专业暗夜工作台 — PS 风格裁剪工具
// 功能: 显示原图、可拖动裁剪框（拖边角/边调整）、暗色遮罩突出保留区域
//       确认后更新原始 Asset 的 croppedDataUrl 和 cropRect（持久化裁剪状态）
//       重新打开时恢复上次裁剪框位置
// ============================================================
import React, { useRef, useEffect, useState, useCallback } from "react";
import { X, Check, RotateCcw, Crop } from "lucide-react";
import type { Asset, CropRect } from "@/lib/types";

interface CropBox {
  x: number; // 相对图片显示区域的百分比 0-100
  y: number;
  w: number;
  h: number;
}

interface CropModalProps {
  asset: Asset;
  /** 确认裁剪后，返回更新了 croppedDataUrl 和 cropRect 的 Asset */
  onConfirm: (updatedAsset: Asset) => void;
  onCancel: () => void;
}

/** 将像素 CropRect 转换为百分比 CropBox */
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

const MIN_SIZE = 5; // 最小裁剪框尺寸（百分比）

export default function CropModal({ asset, onConfirm, onCancel }: CropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 图片在容器中的实际显示区域（px）
  const [imgRect, setImgRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // 裁剪框（百分比，相对于 imgRect）
  // 如果 asset 有上次裁剪记录则恢复，否则默认全图
  const [cropBox, setCropBox] = useState<CropBox>(() => {
    if (asset.cropRect) {
      return cropRectToBox(asset.cropRect, asset.naturalWidth, asset.naturalHeight);
    }
    return { x: 5, y: 5, w: 90, h: 90 };
  });

  // 拖拽状态
  const dragRef = useRef<{
    handle: DragHandle;
    startX: number;
    startY: number;
    startBox: CropBox;
  } | null>(null);

  // 计算图片在容器中的实际显示区域
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

  // 获取鼠标/触摸相对于图片显示区域的百分比坐标
  const getPctCoords = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return { px: 0, py: 0 };
      const rect = container.getBoundingClientRect();
      const relX = clientX - rect.left - imgRect.x;
      const relY = clientY - rect.top - imgRect.y;
      return {
        px: (relX / imgRect.w) * 100,
        py: (relY / imgRect.h) * 100,
      };
    },
    [imgRect]
  );

  // 判断鼠标在哪个控制点上
  const getHandle = useCallback(
    (clientX: number, clientY: number): DragHandle => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const relX = clientX - rect.left - imgRect.x;
      const relY = clientY - rect.top - imgRect.y;
      const px = (relX / imgRect.w) * 100;
      const py = (relY / imgRect.h) * 100;

      const { x, y, w, h } = cropBox;
      const threshold = 3; // 百分比

      const nearLeft = Math.abs(px - x) < threshold;
      const nearRight = Math.abs(px - (x + w)) < threshold;
      const nearTop = Math.abs(py - y) < threshold;
      const nearBottom = Math.abs(py - (y + h)) < threshold;
      const nearCenterX = Math.abs(px - (x + w / 2)) < threshold;
      const nearCenterY = Math.abs(py - (y + h / 2)) < threshold;
      const insideX = px > x + threshold && px < x + w - threshold;
      const insideY = py > y + threshold && py < y + h - threshold;

      if (nearTop && nearLeft) return "tl";
      if (nearTop && nearRight) return "tr";
      if (nearBottom && nearLeft) return "bl";
      if (nearBottom && nearRight) return "br";
      if (nearTop && nearCenterX) return "tc";
      if (nearBottom && nearCenterX) return "bc";
      if (nearLeft && nearCenterY) return "ml";
      if (nearRight && nearCenterY) return "mr";
      if (insideX && insideY) return "move";
      return null;
    },
    [cropBox, imgRect]
  );

  // 鼠标按下
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const handle = getHandle(e.clientX, e.clientY);
      if (!handle) return;
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startBox: { ...cropBox },
      };
    },
    [getHandle, cropBox]
  );

  // 鼠标移动
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { handle, startX, startY, startBox } = dragRef.current;
      const { px: curPx, py: curPy } = getPctCoords(e.clientX, e.clientY);
      const { px: startPx, py: startPy } = getPctCoords(startX, startY);
      const dx = curPx - startPx;
      const dy = curPy - startPy;

      setCropBox((prev) => {
        let { x, y, w, h } = startBox;

        switch (handle) {
          case "move":
            x = Math.max(0, Math.min(100 - w, x + dx));
            y = Math.max(0, Math.min(100 - h, y + dy));
            break;
          case "tl":
            x = Math.min(startBox.x + startBox.w - MIN_SIZE, x + dx);
            y = Math.min(startBox.y + startBox.h - MIN_SIZE, y + dy);
            w = startBox.x + startBox.w - x;
            h = startBox.y + startBox.h - y;
            x = Math.max(0, x);
            y = Math.max(0, y);
            w = Math.max(MIN_SIZE, w);
            h = Math.max(MIN_SIZE, h);
            break;
          case "tr":
            y = Math.min(startBox.y + startBox.h - MIN_SIZE, y + dy);
            h = startBox.y + startBox.h - y;
            w = Math.min(100 - x, Math.max(MIN_SIZE, startBox.w + dx));
            y = Math.max(0, y);
            h = Math.max(MIN_SIZE, h);
            break;
          case "bl":
            x = Math.min(startBox.x + startBox.w - MIN_SIZE, x + dx);
            w = startBox.x + startBox.w - x;
            h = Math.min(100 - y, Math.max(MIN_SIZE, startBox.h + dy));
            x = Math.max(0, x);
            w = Math.max(MIN_SIZE, w);
            break;
          case "br":
            w = Math.min(100 - x, Math.max(MIN_SIZE, startBox.w + dx));
            h = Math.min(100 - y, Math.max(MIN_SIZE, startBox.h + dy));
            break;
          case "tc":
            y = Math.min(startBox.y + startBox.h - MIN_SIZE, y + dy);
            h = startBox.y + startBox.h - y;
            y = Math.max(0, y);
            h = Math.max(MIN_SIZE, h);
            break;
          case "bc":
            h = Math.min(100 - y, Math.max(MIN_SIZE, startBox.h + dy));
            break;
          case "ml":
            x = Math.min(startBox.x + startBox.w - MIN_SIZE, x + dx);
            w = startBox.x + startBox.w - x;
            x = Math.max(0, x);
            w = Math.max(MIN_SIZE, w);
            break;
          case "mr":
            w = Math.min(100 - x, Math.max(MIN_SIZE, startBox.w + dx));
            break;
        }

        return { x, y, w, h };
      });

      // 更新光标（通过 mousemove 事件处理）
    },
    [getPctCoords]
  );

  // 鼠标松开
  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // 获取光标样式
  const [cursorStyle, setCursorStyle] = useState("default");
  const handleMouseMoveForCursor = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) return;
      const handle = getHandle(e.clientX, e.clientY);
      const cursorMap: Record<string, string> = {
        tl: "nwse-resize", tr: "nesw-resize",
        bl: "nesw-resize", br: "nwse-resize",
        tc: "ns-resize", bc: "ns-resize",
        ml: "ew-resize", mr: "ew-resize",
        move: "move",
      };
      setCursorStyle(handle ? cursorMap[handle] || "default" : "default");
    },
    [getHandle]
  );

  // 重置裁剪框（全图）
  const handleReset = () => {
    setCropBox({ x: 5, y: 5, w: 90, h: 90 });
  };

  // 确认裁剪：用 Canvas 截取选定区域，更新原始 Asset 的 croppedDataUrl 和 cropRect
  const handleConfirm = useCallback(async () => {
    const srcX = Math.round((cropBox.x / 100) * asset.naturalWidth);
    const srcY = Math.round((cropBox.y / 100) * asset.naturalHeight);
    const srcW = Math.round((cropBox.w / 100) * asset.naturalWidth);
    const srcH = Math.round((cropBox.h / 100) * asset.naturalHeight);

    const canvas = document.createElement("canvas");
    canvas.width = srcW;
    canvas.height = srcH;
    const ctx = canvas.getContext("2d")!;

    const img = new Image();
    img.src = asset.dataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      if (img.complete) resolve();
    });

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    const croppedDataUrl = canvas.toDataURL("image/png", 1.0);

    // 保存裁剪框坐标（像素，相对于原始图片）
    const cropRect: CropRect = { x: srcX, y: srcY, width: srcW, height: srcH };

    // 返回更新后的 Asset（保留原始 dataUrl，追加裁剪信息）
    const updatedAsset: Asset = {
      ...asset,
      croppedDataUrl,
      cropRect,
    };

    onConfirm(updatedAsset);
  }, [asset, cropBox, onConfirm]);

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleConfirm();
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleConfirm, onCancel]);

  // 裁剪框在 px 中的位置（用于渲染）
  const cropPx = {
    left: imgRect.x + (cropBox.x / 100) * imgRect.w,
    top: imgRect.y + (cropBox.y / 100) * imgRect.h,
    width: (cropBox.w / 100) * imgRect.w,
    height: (cropBox.h / 100) * imgRect.h,
  };

  // 控制点列表
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
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "oklch(0.06 0.01 260 / 0.97)" }}
    >
      {/* 顶部工具栏 */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{
          background: "oklch(0.12 0.015 260 / 0.95)",
          borderBottom: "1px solid oklch(1 0 0 / 0.08)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: "oklch(0.58 0.22 264 / 0.15)" }}
          >
            <Crop size={14} style={{ color: "oklch(0.72 0.12 264)" }} />
            <span
              className="text-sm font-semibold"
              style={{
                color: "oklch(0.85 0.01 260)",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              裁剪图片
            </span>
          </div>
          <span
            className="text-xs"
            style={{
              color: "oklch(0.45 0.01 260)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {asset.name}
          </span>
          {asset.cropRect && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: "oklch(0.62 0.20 45 / 0.15)",
                color: "oklch(0.72 0.18 45)",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              已恢复上次裁剪位置
            </span>
          )}
        </div>

        {/* 裁剪尺寸信息 */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: "oklch(0.15 0.015 260)",
            border: "1px solid oklch(1 0 0 / 0.08)",
          }}
        >
          <span
            className="text-xs"
            style={{
              color: "oklch(0.72 0.12 264)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {cropW} × {cropH} px
          </span>
          <span
            className="text-xs"
            style={{ color: "oklch(0.40 0.01 260)", fontFamily: "'JetBrains Mono', monospace" }}
          >
            ({cropBox.x.toFixed(1)}%, {cropBox.y.toFixed(1)}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 重置 */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{
              background: "oklch(0.20 0.015 260)",
              border: "1px solid oklch(1 0 0 / 0.1)",
              color: "oklch(0.65 0.01 260)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <RotateCcw size={13} />
            重置
          </button>

          {/* 取消 */}
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{
              background: "oklch(0.20 0.015 260)",
              border: "1px solid oklch(1 0 0 / 0.1)",
              color: "oklch(0.65 0.01 260)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <X size={13} />
            取消
          </button>

          {/* 确认裁剪 */}
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "oklch(0.58 0.22 264)",
              color: "oklch(0.98 0.005 260)",
              fontFamily: "'Space Grotesk', sans-serif",
              boxShadow: "0 0 12px oklch(0.58 0.22 264 / 0.3)",
            }}
          >
            <Check size={13} />
            确认裁剪
          </button>
        </div>
      </div>

      {/* 提示文字 */}
      <div
        className="flex-shrink-0 text-center py-1.5 text-xs"
        style={{ color: "oklch(0.40 0.01 260)" }}
      >
        拖动裁剪框的边或角调整保留区域 · Enter 确认 · Esc 取消 · 裁剪位置自动记忆
      </div>

      {/* 主编辑区 */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveForCursor}
      >
        {/* 原图 */}
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

        {/* 四周暗色遮罩（突出保留区域） */}
        {/* 上方遮罩 */}
        <div
          style={{
            position: "absolute",
            left: imgRect.x,
            top: imgRect.y,
            width: imgRect.w,
            height: (cropBox.y / 100) * imgRect.h,
            background: "oklch(0.05 0.01 260 / 0.72)",
            pointerEvents: "none",
          }}
        />
        {/* 下方遮罩 */}
        <div
          style={{
            position: "absolute",
            left: imgRect.x,
            top: imgRect.y + ((cropBox.y + cropBox.h) / 100) * imgRect.h,
            width: imgRect.w,
            height: imgRect.h - ((cropBox.y + cropBox.h) / 100) * imgRect.h,
            background: "oklch(0.05 0.01 260 / 0.72)",
            pointerEvents: "none",
          }}
        />
        {/* 左方遮罩 */}
        <div
          style={{
            position: "absolute",
            left: imgRect.x,
            top: imgRect.y + (cropBox.y / 100) * imgRect.h,
            width: (cropBox.x / 100) * imgRect.w,
            height: (cropBox.h / 100) * imgRect.h,
            background: "oklch(0.05 0.01 260 / 0.72)",
            pointerEvents: "none",
          }}
        />
        {/* 右方遮罩 */}
        <div
          style={{
            position: "absolute",
            left: imgRect.x + ((cropBox.x + cropBox.w) / 100) * imgRect.w,
            top: imgRect.y + (cropBox.y / 100) * imgRect.h,
            width: imgRect.w - ((cropBox.x + cropBox.w) / 100) * imgRect.w,
            height: (cropBox.h / 100) * imgRect.h,
            background: "oklch(0.05 0.01 260 / 0.72)",
            pointerEvents: "none",
          }}
        />

        {/* 裁剪框 */}
        <div
          style={{
            position: "absolute",
            left: cropPx.left,
            top: cropPx.top,
            width: cropPx.width,
            height: cropPx.height,
            border: "1.5px solid oklch(0.90 0.005 260)",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          {/* 三等分辅助线（九宫格） */}
          {[1, 2].map((i) => (
            <React.Fragment key={i}>
              <div
                style={{
                  position: "absolute",
                  left: `${(i / 3) * 100}%`,
                  top: 0,
                  width: "1px",
                  height: "100%",
                  background: "oklch(1 0 0 / 0.2)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: `${(i / 3) * 100}%`,
                  left: 0,
                  height: "1px",
                  width: "100%",
                  background: "oklch(1 0 0 / 0.2)",
                }}
              />
            </React.Fragment>
          ))}

          {/* 控制点 */}
          {handles.map(({ id, style }) => (
            <div
              key={id}
              style={{
                position: "absolute",
                width: 10,
                height: 10,
                background: "oklch(0.98 0.005 260)",
                border: "1.5px solid oklch(0.58 0.22 264)",
                borderRadius: 2,
                boxShadow: "0 0 4px oklch(0 0 0 / 0.5)",
                pointerEvents: "none",
                ...style,
              }}
            />
          ))}
        </div>
      </div>

      {/* 底部信息栏 */}
      <div
        className="flex-shrink-0 flex items-center justify-center gap-6 px-6 py-2"
        style={{
          background: "oklch(0.12 0.015 260 / 0.95)",
          borderTop: "1px solid oklch(1 0 0 / 0.08)",
        }}
      >
        <span
          className="text-xs"
          style={{ color: "oklch(0.40 0.01 260)", fontFamily: "'JetBrains Mono', monospace" }}
        >
          原图：{asset.naturalWidth} × {asset.naturalHeight} px
        </span>
        <span
          className="text-xs"
          style={{ color: "oklch(0.58 0.22 264 / 0.7)", fontFamily: "'JetBrains Mono', monospace" }}
        >
          →
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: "oklch(0.72 0.12 264)", fontFamily: "'JetBrains Mono', monospace" }}
        >
          裁剪后：{cropW} × {cropH} px
        </span>
      </div>
    </div>
  );
}
