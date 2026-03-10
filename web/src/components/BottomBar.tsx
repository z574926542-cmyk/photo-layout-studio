// ============================================================
// 奇妙奇遇光影集 排版 Studio — 底部状态栏
// Design: 专业暗夜工作台
// 功能: 缩放滑块、模式指示、快捷键提示
// ============================================================
import React from "react";
import { useStudio } from "@/contexts/StudioContext";

export default function BottomBar() {
  const { state, setZoom } = useStudio();
  const { zoom, mode, slots, assets } = state;

  const modeLabel = mode === "draw" ? "绘制模式" : "选择模式";
  const modeColor = mode === "draw"
    ? "oklch(0.72 0.16 55)"
    : "oklch(0.58 0.22 264)";

  const filledCount = slots.filter((s) => s.assetId !== null).length;

  return (
    <div
      className="h-7 flex-shrink-0 flex items-center px-4 gap-4"
      style={{
        background: "oklch(0.11 0.012 260)",
        borderTop: "1px solid oklch(1 0 0 / 0.07)",
      }}
    >
      {/* 模式指示 */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: modeColor }}
        />
        <span
          className="text-xs"
          style={{
            color: "oklch(0.48 0.01 260)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.7rem",
          }}
        >
          {modeLabel}
        </span>
      </div>

      <div className="w-px h-3 flex-shrink-0" style={{ background: "oklch(1 0 0 / 0.08)" }} />

      {/* 统计 */}
      <div
        className="text-xs flex-shrink-0"
        style={{
          color: "oklch(0.42 0.01 260)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.7rem",
        }}
      >
        {slots.length} 框 · {filledCount} 已填 · {assets.length} 素材
      </div>

      <div className="flex-1" />

      {/* 缩放滑块 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-xs"
          style={{
            color: "oklch(0.38 0.01 260)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.65rem",
          }}
        >
          20%
        </span>
        <input
          type="range"
          min={0.2}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-28"
          style={{ cursor: "pointer", accentColor: "oklch(0.58 0.22 264)" }}
        />
        <span
          className="text-xs"
          style={{
            color: "oklch(0.38 0.01 260)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.65rem",
          }}
        >
          400%
        </span>
      </div>

      <div className="w-px h-3 flex-shrink-0" style={{ background: "oklch(1 0 0 / 0.08)" }} />

      {/* 快捷键提示 */}
      <div
        className="hidden lg:flex items-center gap-3 text-xs flex-shrink-0"
        style={{
          color: "oklch(0.35 0.01 260)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.65rem",
        }}
      >
        <span>V 选择</span>
        <span>R 绘框</span>
        <span>Del 删除</span>
        <span>Ctrl+Z 撤销</span>
      </div>
    </div>
  );
}
