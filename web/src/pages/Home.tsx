// ============================================================
// 奇妙奇遇光影集 排版 Studio — 主页面
// Design: 专业暗夜工作台 × 三栏式布局
// ============================================================
import React from "react";
import { StudioProvider } from "@/contexts/StudioContext";
import TopToolbar from "@/components/TopToolbar";
import LeftPanel from "@/components/LeftPanel";
import StudioCanvas from "@/components/StudioCanvas";
import RightPanel from "@/components/RightPanel";
import BottomBar from "@/components/BottomBar";

// ─── Studio 主体 ──────────────────────────────────────────
function StudioLayout() {
  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: "oklch(0.12 0.015 260)" }}
    >
      {/* 顶部工具栏 */}
      <TopToolbar />

      {/* 主体三栏 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧控制面板 */}
        <LeftPanel />

        {/* 中央画布区 */}
        <div
          className="flex-1 overflow-auto"
          data-canvas-container="true"
        >
          <StudioCanvas />
        </div>

        {/* 右侧素材库 */}
        <RightPanel />
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
