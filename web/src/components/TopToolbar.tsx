// ============================================================
// 奇妙奇遇光影集 排版 Studio — 顶部工具栏
// Design: 专业暗夜工作台
// 功能: 模式切换、撤销/重做、缩放控制、新建、导出
// ============================================================
import React, { useState } from "react";
import appLogo from "@/assets/app-logo.png";
import { useStudio } from "@/contexts/StudioContext";
import { cn } from "@/lib/utils";
import {
  MousePointer2, Square, Undo2, Redo2, Trash2,
  ZoomIn, ZoomOut, Download, Loader2, Zap,
  FilePlus, X, Check, Layers,
} from "lucide-react";

export default function TopToolbar() {
  const {
    state,
    setMode,
    setZoom,
    undo,
    redo,
    clearSlots,
    clearAllFills,
    autoFill,
    exportPng,
    newCanvas,
    canUndo,
    canRedo,
  } = useStudio();
  const { mode, zoom, canvas, isExporting, slots } = state;
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [newW, setNewW] = useState("1200");
  const [newH, setNewH] = useState("900");

  const zoomPct = Math.round(zoom * 100);

  const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];

  const zoomIn = () => {
    const next = ZOOM_STEPS.find((z) => z > zoom);
    if (next) setZoom(next);
  };

  const zoomOut = () => {
    const prev = [...ZOOM_STEPS].reverse().find((z) => z < zoom);
    if (prev) setZoom(prev);
  };

  const handleNewCanvas = () => {
    const w = parseInt(newW);
    const h = parseInt(newH);
    if (w > 0 && h > 0) {
      newCanvas(w, h);
      setShowNewCanvas(false);
    }
  };

  return (
    <>
      <div
        className="h-12 flex-shrink-0 flex items-center px-3 gap-0.5"
        style={{
          background: "oklch(0.14 0.016 260 / 0.98)",
          borderBottom: "1px solid oklch(1 0 0 / 0.08)",
        }}
      >
        {/* 品牌 */}
        <div className="flex items-center gap-2 mr-2 flex-shrink-0">
          <img
            src={appLogo}
            alt="光影集"
            className="w-7 h-7 rounded-md flex-shrink-0"
            style={{ objectFit: "cover", boxShadow: "0 2px 8px oklch(0.58 0.22 264 / 0.4)" }}
          />
          <span
            className="text-sm font-semibold hidden lg:block"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: "oklch(0.75 0.01 260)",
              letterSpacing: "-0.01em",
            }}
          >
            光影集
          </span>
        </div>

        <Divider />

        {/* 新建 */}
        <ToolButton
          onClick={() => setShowNewCanvas(true)}
          title="新建画布"
        >
          <FilePlus size={15} />
        </ToolButton>

        <Divider />

        {/* 工具模式 */}
        <ToolButton
          active={mode === "select"}
          onClick={() => setMode("select")}
          title="选择/移动 (V)"
        >
          <MousePointer2 size={15} />
        </ToolButton>
        <ToolButton
          active={mode === "draw"}
          onClick={() => setMode("draw")}
          title="绘制图框 (R)"
        >
          <Square size={15} />
        </ToolButton>

        <Divider />

        {/* 撤销/重做 */}
        <ToolButton onClick={undo} disabled={!canUndo} title="撤销 (Ctrl+Z)">
          <Undo2 size={15} />
        </ToolButton>
        <ToolButton onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Y)">
          <Redo2 size={15} />
        </ToolButton>

        <Divider />

        {/* 图框操作 */}
        <ToolButton
          onClick={autoFill}
          title="自动填充：按宽高比将素材库中的图片依次填入空图框"
          className="gap-1.5 px-2.5 w-auto"
        >
          <Zap size={13} />
          <span className="text-xs hidden sm:inline" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            自动填充
          </span>
        </ToolButton>
        <ToolButton
          onClick={clearAllFills}
          disabled={slots.length === 0 || slots.every((s: { assetId: string | null }) => !s.assetId)}
          title="清空图片：清除所有图框中的图片，保留图框结构"
        >
          <Trash2 size={15} />
        </ToolButton>

        <Divider />

        {/* 缩放控制 */}
        <ToolButton onClick={zoomOut} title="缩小 (-)">
          <ZoomOut size={15} />
        </ToolButton>
        <button
          className="px-2 py-1 rounded text-xs transition-colors flex-shrink-0"
          style={{
            color: "oklch(0.70 0.01 260)",
            background: "oklch(1 0 0 / 0.05)",
            minWidth: "3.5rem",
            textAlign: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.75rem",
          }}
          title="缩放比例"
        >
          {zoomPct}%
        </button>
        <ToolButton onClick={zoomIn} title="放大 (+)">
          <ZoomIn size={15} />
        </ToolButton>

        {/* 画布信息 */}
        <div
          className="ml-1 px-2 py-1 rounded text-xs hidden md:block flex-shrink-0"
          style={{
            background: "oklch(1 0 0 / 0.04)",
            color: "oklch(0.45 0.01 260)",
            border: "1px solid oklch(1 0 0 / 0.06)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.7rem",
          }}
        >
          {canvas.width} × {canvas.height}
        </div>

        <div className="flex-1" />

        {/* 图框数量 */}
        <div
          className="text-xs hidden sm:block flex-shrink-0 mr-2"
          style={{
            color: "oklch(0.45 0.01 260)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {slots.length} 框
        </div>

        <Divider />

        {/* 导出按钮 */}
        <button
          onClick={exportPng}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all flex-shrink-0"
          style={{
            background: isExporting
              ? "oklch(0.45 0.15 264)"
              : "oklch(0.58 0.22 264)",
            color: "oklch(0.98 0.005 260)",
            boxShadow: isExporting ? "none" : "0 2px 10px oklch(0.58 0.22 264 / 0.45)",
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: "0.01em",
          }}
        >
          {isExporting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Download size={13} />
          )}
          {isExporting ? "导出中..." : "导出 PNG"}
        </button>
      </div>

      {/* 新建画布对话框 */}
      {showNewCanvas && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "oklch(0 0 0 / 0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && setShowNewCanvas(false)}
        >
          <div
            className="rounded-xl p-6 w-80 shadow-2xl"
            style={{
              background: "oklch(0.17 0.018 260)",
              border: "1px solid oklch(1 0 0 / 0.12)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3
                className="text-sm font-semibold"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: "oklch(0.92 0.008 260)",
                }}
              >
                新建画布
              </h3>
              <button
                onClick={() => setShowNewCanvas(false)}
                style={{ color: "oklch(0.50 0.01 260)" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* 快速预设 */}
            <div className="mb-4">
              <div className="text-xs mb-2" style={{ color: "oklch(0.55 0.015 260)" }}>快速预设</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "正方形 1:1", w: 1200, h: 1200 },
                  { label: "横版 4:3", w: 1200, h: 900 },
                  { label: "竖版 3:4", w: 900, h: 1200 },
                  { label: "宽屏 16:9", w: 1920, h: 1080 },
                  { label: "A4 竖版", w: 2480, h: 3508 },
                  { label: "微信封面", w: 900, h: 500 },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => { setNewW(String(p.w)); setNewH(String(p.h)); }}
                    className="px-2 py-1.5 rounded text-xs text-left transition-all"
                    style={{
                      background: newW === String(p.w) && newH === String(p.h)
                        ? "oklch(0.58 0.22 264 / 0.2)"
                        : "oklch(0.22 0.02 260)",
                      border: newW === String(p.w) && newH === String(p.h)
                        ? "1px solid oklch(0.58 0.22 264 / 0.5)"
                        : "1px solid oklch(1 0 0 / 0.08)",
                      color: "oklch(0.75 0.01 260)",
                    }}
                  >
                    <div style={{ fontSize: "0.7rem", fontWeight: 500 }}>{p.label}</div>
                    <div
                      className="mono-input"
                      style={{ fontSize: "0.65rem", color: "oklch(0.50 0.01 260)" }}
                    >
                      {p.w}×{p.h}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义尺寸 */}
            <div className="flex gap-2 mb-5">
              <div className="flex-1">
                <label className="block text-xs mb-1" style={{ color: "oklch(0.55 0.015 260)" }}>宽 (px)</label>
                <input
                  type="number"
                  value={newW}
                  onChange={(e) => setNewW(e.target.value)}
                  className="w-full px-2 py-1.5 rounded text-sm mono-input"
                  style={{
                    background: "oklch(0.20 0.015 260)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    color: "oklch(0.92 0.008 260)",
                    outline: "none",
                  }}
                  min={1}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs mb-1" style={{ color: "oklch(0.55 0.015 260)" }}>高 (px)</label>
                <input
                  type="number"
                  value={newH}
                  onChange={(e) => setNewH(e.target.value)}
                  className="w-full px-2 py-1.5 rounded text-sm mono-input"
                  style={{
                    background: "oklch(0.20 0.015 260)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    color: "oklch(0.92 0.008 260)",
                    outline: "none",
                  }}
                  min={1}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowNewCanvas(false)}
                className="flex-1 py-2 rounded text-xs transition-all"
                style={{
                  background: "oklch(0.22 0.02 260)",
                  border: "1px solid oklch(1 0 0 / 0.08)",
                  color: "oklch(0.65 0.01 260)",
                }}
              >
                取消
              </button>
              <button
                onClick={handleNewCanvas}
                className="flex-1 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                style={{
                  background: "oklch(0.58 0.22 264)",
                  color: "oklch(0.98 0.005 260)",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                <Check size={13} />
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── 工具按钮 ─────────────────────────────────────────────
function ToolButton({
  children,
  active,
  onClick,
  disabled,
  title,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex items-center justify-center h-8 w-8 rounded transition-all duration-150",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        active
          ? "text-indigo-400"
          : "text-[oklch(0.55_0.01_260)] hover:text-[oklch(0.85_0.008_260)] hover:bg-white/8",
        className
      )}
      style={active ? {
        background: "oklch(0.58 0.22 264 / 0.18)",
        boxShadow: "0 0 0 1px oklch(0.58 0.22 264 / 0.35)",
      } : undefined}
    >
      {children}
    </button>
  );
}

//// ─── 模板工坊导航按鈕（已移除，路由不存在）────────────────
// WorkshopNavButton removed - no /workshop route
// Placeholder to avoid breaking changes
function _WorkshopNavButton_unused() {
  return (
    <button
      onClick={() => {}}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all flex-shrink-0"
      style={{
        background: "oklch(0.65 0.18 145 / 0.12)",
        border: "1px solid oklch(0.65 0.18 145 / 0.3)",
        color: "oklch(0.75 0.14 145)",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
      title="模板工坊：可视化制作和分享模板"
    >
      <Layers size={13} />
      模板工坊
    </button>
  );
}

// ─── 分隔线 ─────────────────────────────────────────────
function Divider() {
  return (
    <div
      className="w-px h-5 mx-1 flex-shrink-0"
      style={{ background: "oklch(1 0 0 / 0.1)" }}
    />
  );
}
