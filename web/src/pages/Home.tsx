// ============================================================
// 奇妙奇遇光影集 排版 Studio — 主页面
// Design: 专业暗夜工作台 × 三栏式布局
// ============================================================
import appLogo from "@/assets/app-logo.png";
import React, { useState } from "react";
import { StudioProvider, useStudio } from "@/contexts/StudioContext";
import TopToolbar from "@/components/TopToolbar";
import LeftPanel from "@/components/LeftPanel";
import StudioCanvas from "@/components/StudioCanvas";
import RightPanel from "@/components/RightPanel";
import BottomBar from "@/components/BottomBar";
import { PRESET_TEMPLATES } from "@/lib/utils";
import { LayoutTemplate, Sparkles, X } from "lucide-react";

// ─── 欢迎引导界面 ─────────────────────────────────────────
function WelcomeOverlay({ onDismiss }: { onDismiss: () => void }) {
  const { loadPreset, newCanvas } = useStudio();

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "oklch(0.10 0.01 260 / 0.92)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "oklch(0.17 0.018 260)",
          border: "1px solid oklch(1 0 0 / 0.12)",
          boxShadow: "0 24px 80px oklch(0 0 0 / 0.6)",
        }}
      >
        {/* 头部 */}
        <div
          className="px-8 py-6 relative"
          style={{
            background: "linear-gradient(135deg, oklch(0.20 0.04 264), oklch(0.17 0.025 280))",
            borderBottom: "1px solid oklch(1 0 0 / 0.08)",
          }}
        >
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
            style={{ color: "oklch(0.55 0.015 260)" }}
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <img
              src={appLogo}
              alt="光影集"
              className="w-10 h-10 rounded-xl"
              style={{ objectFit: "cover", boxShadow: "0 4px 16px oklch(0.58 0.22 264 / 0.5)" }}
            />
            <div>
              <h1
                className="text-lg font-bold"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: "oklch(0.95 0.008 260)",
                }}
              >
                奇妙奇遇光影集
              </h1>
              <p className="text-xs" style={{ color: "oklch(0.60 0.015 260)" }}>
                专业照片排版 Studio · 完全离线运行
              </p>
            </div>
          </div>
          <p className="text-sm" style={{ color: "oklch(0.72 0.01 260)", lineHeight: 1.6 }}>
            通过手绘或预设方式定义图框，智能将照片填充到画框中，支持像素级规格控制。
          </p>
        </div>

        {/* 快速开始 */}
        <div className="px-8 py-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} style={{ color: "oklch(0.72 0.16 55)" }} />
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: "oklch(0.55 0.015 260)",
                letterSpacing: "0.1em",
              }}
            >
              快速开始 — 选择预设模板
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {PRESET_TEMPLATES.slice(0, 6).map((preset) => (
              <button
                key={preset.id}
                onClick={() => { loadPreset(preset.id); onDismiss(); }}
                className="p-3 rounded-xl text-left transition-all group"
                style={{
                  background: "oklch(0.20 0.018 260)",
                  border: "1px solid oklch(1 0 0 / 0.08)",
                }}
              >
                {/* 预览缩略图 */}
                <div
                  className="w-full mb-2 rounded overflow-hidden"
                  style={{
                    aspectRatio: `${preset.canvas.width} / ${preset.canvas.height}`,
                    maxHeight: "60px",
                    background: "oklch(0.14 0.015 260)",
                    position: "relative",
                  }}
                >
                  {preset.slots.map((s, i) => (
                    <div
                      key={i}
                      className="absolute"
                      style={{
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        width: `${s.w}%`,
                        height: `${s.h}%`,
                        background: `oklch(${0.25 + i * 0.05} 0.04 264)`,
                        border: "1px solid oklch(0.58 0.22 264 / 0.3)",
                      }}
                    />
                  ))}
                </div>
                <div
                  className="text-xs font-medium"
                  style={{ color: "oklch(0.80 0.01 260)", fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {preset.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "oklch(0.48 0.01 260)" }}>
                  {preset.slots.length} 个图框
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "oklch(0.22 0.02 260)",
                border: "1px solid oklch(1 0 0 / 0.08)",
                color: "oklch(0.70 0.01 260)",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              从空白画布开始
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Studio 主体 ──────────────────────────────────────────
function StudioLayout() {
  const [showWelcome, setShowWelcome] = useState(true);

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden relative"
      style={{ background: "oklch(0.12 0.015 260)" }}
    >
      {/* 顶部工具栏 */}
      <TopToolbar />

      {/* 主体三栏 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 左侧控制面板 */}
        <LeftPanel />

        {/* 中央画布区 */}
        <div
          className="flex-1 overflow-auto relative"
          data-canvas-container="true"
        >
          <StudioCanvas />
        </div>

        {/* 右侧素材库 */}
        <RightPanel />

        {/* 欢迎引导 */}
        {showWelcome && (
          <WelcomeOverlay onDismiss={() => setShowWelcome(false)} />
        )}
      </div>

      {/* 底部状态栏 */}
      <BottomBar />
    </div>
  );
}

// ─── 主导出 ───────────────────────────────────────────────
export default function Home() {
  return (
    <StudioProvider>
      <StudioLayout />
    </StudioProvider>
  );
}
