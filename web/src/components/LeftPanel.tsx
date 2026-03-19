// ============================================================
// 奇妙奇遇光影集 排版 Studio — 左侧控制面板
// Design: 专业暗夜工作台 — 玻璃磨砂面板
// 功能: 画布设置、图框精调、方案管理、预设模板
// ============================================================
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useStudio } from "@/contexts/StudioContext";
import { PRESET_TEMPLATES, round } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Lock, Unlock, Trash2, Plus, Save, FolderOpen,
  ChevronDown, ChevronRight, Pencil, Check, X,
  Image, Layers, LayoutTemplate, Bookmark, PackagePlus, Upload, Loader2,
  ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Copy, RotateCcw,
} from "lucide-react";
import type { TemplateIndex } from "@/lib/templateDb";
import { getThumbnail, loadTemplateDetail } from "@/lib/templateDb";
import { toast } from "sonner";

type PanelSection = "canvas" | "slot" | "layers" | "schemes" | "presets" | "templates";

export default function LeftPanel() {
  const [openSections, setOpenSections] = useState<Set<PanelSection>>(
    new Set<PanelSection>(["canvas", "slot", "layers"])
  );

  const toggleSection = (s: PanelSection) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  return (
    <div
      className="w-72 flex-shrink-0 flex flex-col h-full overflow-y-auto"
      style={{
        background: "oklch(0.15 0.016 260 / 0.95)",
        borderRight: "1px solid oklch(1 0 0 / 0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* 品牌标题 */}
      <div
        className="px-4 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid oklch(1 0 0 / 0.08)" }}
      >
        <div
          className="text-sm font-bold tracking-wide"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: "oklch(0.92 0.008 260)" }}
        >
          奇妙奇遇光影集
        </div>
        <div
          className="text-xs mt-0.5"
          style={{ color: "oklch(0.55 0.015 260)", fontFamily: "'JetBrains Mono', monospace" }}
        >
          排版 Studio v1.2
        </div>
      </div>

      {/* 画布设置 */}
      <SectionHeader
        icon={<Image size={14} />}
        title="画布设置"
        open={openSections.has("canvas")}
        onToggle={() => toggleSection("canvas")}
      />
      {openSections.has("canvas") && <CanvasSection />}

      {/* 图框精调 */}
      <SectionHeader
        icon={<Layers size={14} />}
        title="图框精调"
        open={openSections.has("slot")}
        onToggle={() => toggleSection("slot")}
      />
      {openSections.has("slot") && <SlotSection />}

      {/* 图层管理 */}
      <SectionHeader
        icon={<ChevronsUp size={14} />}
        title="图层管理"
        open={openSections.has("layers")}
        onToggle={() => toggleSection("layers")}
        accent="oklch(0.72 0.16 55)"
      />
      {openSections.has("layers") && <LayerPanel />}

      {/* 方案管理 */}
      <SectionHeader
        icon={<Bookmark size={14} />}
        title="方案管理"
        open={openSections.has("schemes")}
        onToggle={() => toggleSection("schemes")}
      />
      {openSections.has("schemes") && <SchemesSection />}

      {/* 预设模板 */}
      <SectionHeader
        icon={<LayoutTemplate size={14} />}
        title="预设模板"
        open={openSections.has("presets")}
        onToggle={() => toggleSection("presets")}
      />
      {openSections.has("presets") && <PresetsSection />}

      {/* 模板管理 */}
      <SectionHeader
        icon={<PackagePlus size={14} />}
        title="模板管理"
        open={openSections.has("templates")}
        onToggle={() => toggleSection("templates")}
        accent="oklch(0.65 0.18 145)"
      />
      {openSections.has("templates") && <TemplatesSection />}

      <div className="flex-1" />
    </div>
  );
}

// ─── 区块标题 ─────────────────────────────────────────────
function SectionHeader({
  icon, title, open, onToggle, accent,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  accent?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors"
      style={{
        borderBottom: "1px solid oklch(1 0 0 / 0.06)",
        color: "oklch(0.65 0.015 260)",
      }}
    >
      <span style={{ color: accent ?? "oklch(0.58 0.22 264)" }}>{icon}</span>
      <span
        className="flex-1 text-xs font-semibold uppercase tracking-widest"
        style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.1em" }}
      >
        {title}
      </span>
      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    </button>
  );
}

// ─── 画布设置区块 ─────────────────────────────────────────
function CanvasSection() {
  const { state, dispatch, newCanvas, uploadBackground, clearBackground } = useStudio();
  const { canvas, aspectLocked } = state;
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [widthStr, setWidthStr] = useState(String(canvas.width));
  const [heightStr, setHeightStr] = useState(String(canvas.height));

  const handleWidthChange = (val: string) => {
    setWidthStr(val);
    const w = parseInt(val);
    if (!isNaN(w) && w > 0) {
      if (aspectLocked) {
        const ratio = canvas.height / canvas.width;
        const newH = Math.round(w * ratio);
        setHeightStr(String(newH));
        dispatch({ type: "SET_CANVAS", canvas: { width: w, height: newH } });
      } else {
        dispatch({ type: "SET_CANVAS", canvas: { width: w } });
      }
    }
  };

  const handleHeightChange = (val: string) => {
    setHeightStr(val);
    const h = parseInt(val);
    if (!isNaN(h) && h > 0) {
      if (aspectLocked) {
        const ratio = canvas.width / canvas.height;
        const newW = Math.round(h * ratio);
        setWidthStr(String(newW));
        dispatch({ type: "SET_CANVAS", canvas: { width: newW, height: h } });
      } else {
        dispatch({ type: "SET_CANVAS", canvas: { height: h } });
      }
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadBackground(file);
    e.target.value = "";
  };

  return (
    <div className="px-4 py-3 space-y-3" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}>
      {/* 尺寸输入 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: "oklch(0.55 0.015 260)" }}>宽度 (px)</label>
            <input
              type="number"
              value={widthStr}
              onChange={(e) => handleWidthChange(e.target.value)}
              className="w-full px-2 py-1.5 rounded text-sm mono-input"
              style={{
                background: "oklch(0.20 0.015 260)",
                border: "1px solid oklch(1 0 0 / 0.1)",
                color: "oklch(0.92 0.008 260)",
                outline: "none",
              }}
              min={1}
              max={10000}
            />
          </div>
          <button
            onClick={() => dispatch({ type: "SET_ASPECT_LOCKED", locked: !aspectLocked })}
            className="mt-5 p-1.5 rounded transition-colors"
            style={{
              color: aspectLocked ? "oklch(0.58 0.22 264)" : "oklch(0.45 0.01 260)",
              background: aspectLocked ? "oklch(0.58 0.22 264 / 0.15)" : "transparent",
            }}
            title={aspectLocked ? "解锁比例" : "锁定比例"}
          >
            {aspectLocked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: "oklch(0.55 0.015 260)" }}>高度 (px)</label>
            <input
              type="number"
              value={heightStr}
              onChange={(e) => handleHeightChange(e.target.value)}
              className="w-full px-2 py-1.5 rounded text-sm mono-input"
              style={{
                background: "oklch(0.20 0.015 260)",
                border: "1px solid oklch(1 0 0 / 0.1)",
                color: "oklch(0.92 0.008 260)",
                outline: "none",
              }}
              min={1}
              max={10000}
            />
          </div>
        </div>

        {/* 背景色 */}
        <div className="flex items-center gap-2">
          <label className="text-xs flex-shrink-0" style={{ color: "oklch(0.55 0.015 260)" }}>背景色</label>
          <input
            type="color"
            value={canvas.backgroundColor}
            onChange={(e) => dispatch({ type: "SET_CANVAS", canvas: { backgroundColor: e.target.value } })}
            className="w-8 h-7 rounded cursor-pointer border-0 p-0"
            style={{ background: "none" }}
          />
          <span className="text-xs mono-input flex-1" style={{ color: "oklch(0.55 0.015 260)" }}>
            {canvas.backgroundColor}
          </span>
        </div>
      </div>

      {/* 底图控制 */}
      <div className="space-y-1.5">
        <div className="text-xs" style={{ color: "oklch(0.55 0.015 260)" }}>底图模式</div>
        <div className="flex gap-2">
          <button
            onClick={() => bgInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-all"
            style={{
              background: "oklch(0.58 0.22 264 / 0.15)",
              border: "1px solid oklch(0.58 0.22 264 / 0.3)",
              color: "oklch(0.78 0.12 264)",
            }}
          >
            <Image size={12} />
            上传底图
          </button>
          {canvas.backgroundImage && (
            <button
              onClick={clearBackground}
              className="px-2 py-1.5 rounded text-xs transition-all"
              style={{
                background: "oklch(0.62 0.22 25 / 0.15)",
                border: "1px solid oklch(0.62 0.22 25 / 0.3)",
                color: "oklch(0.75 0.15 25)",
              }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        {canvas.backgroundImage && (
          <div className="text-xs" style={{ color: "oklch(0.65 0.18 145)" }}>
            ✓ 底图已设置 · {canvas.width} × {canvas.height}
          </div>
        )}
        <input
          ref={bgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBgUpload}
        />
      </div>
    </div>
  );
}

// ─── 图框精调区块 ─────────────────────────────────────────
function SlotSection() {
  const { selectedSlot, updateSlot, deleteSelectedSlot } = useStudio();

  if (!selectedSlot) {
    return (
      <div
        className="px-4 py-4 text-center"
        style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}
      >
        <div className="text-xs" style={{ color: "oklch(0.45 0.01 260)" }}>
          点击画布上的图框以选中并精调
        </div>
      </div>
    );
  }

  const handleChange = (field: "x" | "y" | "w" | "h", val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      updateSlot(selectedSlot.id, { [field]: round(num, 2) });
    }
  };

  const handleOffsetChange = (field: "offsetX" | "offsetY", val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      updateSlot(selectedSlot.id, { [field]: round(num, 1) });
    }
  };

  const handleScaleChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      updateSlot(selectedSlot.id, { scale: round(num, 2) });
    }
  };
  const handleRotationChange = (val: number) => {
    const clamped = Math.max(-180, Math.min(180, val));
    updateSlot(selectedSlot.id, { rotation: round(clamped, 1) });
  };
  const handleRotationWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    const current = selectedSlot.rotation ?? 0;
    handleRotationChange(current + (e.deltaY > 0 ? step : -step));
  };

  return (
    <div
      className="px-4 py-3 space-y-3"
      style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}
    >
      {/* 位置 */}
      <div>
        <div className="text-xs mb-2" style={{ color: "oklch(0.55 0.015 260)" }}>位置 (%)</div>
        <div className="grid grid-cols-2 gap-2">
          <CoordInput label="X" value={selectedSlot.x} onChange={(v) => handleChange("x", v)} />
          <CoordInput label="Y" value={selectedSlot.y} onChange={(v) => handleChange("y", v)} />
        </div>
      </div>

      {/* 尺寸 */}
      <div>
        <div className="text-xs mb-2" style={{ color: "oklch(0.55 0.015 260)" }}>尺寸 (%)</div>
        <div className="grid grid-cols-2 gap-2">
          <CoordInput label="W" value={selectedSlot.w} onChange={(v) => handleChange("w", v)} />
          <CoordInput label="H" value={selectedSlot.h} onChange={(v) => handleChange("h", v)} />
        </div>
      </div>

      {/* 图片偏移（有填充时显示） */}
      {selectedSlot.assetId && (
        <div>
          <div className="text-xs mb-2" style={{ color: "oklch(0.55 0.015 260)" }}>图片位置 (%)</div>
          <div className="grid grid-cols-2 gap-2">
            <CoordInput
              label="↔"
              value={selectedSlot.offsetX}
              onChange={(v) => handleOffsetChange("offsetX", v)}
              step={1}
              min={-50}
              max={50}
            />
            <CoordInput
              label="↕"
              value={selectedSlot.offsetY}
              onChange={(v) => handleOffsetChange("offsetY", v)}
              step={1}
              min={-50}
              max={50}
            />
          </div>
          <div className="mt-2">
            <div className="text-xs mb-1" style={{ color: "oklch(0.55 0.015 260)" }}>缩放</div>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={selectedSlot.scale}
              onChange={(e) => handleScaleChange(e.target.value)}
              className="w-full accent-indigo-500"
            />
            <div className="text-xs text-right mono-input" style={{ color: "oklch(0.58 0.22 264)" }}>
              {(selectedSlot.scale * 100).toFixed(0)}%
            </div>
          </div>
          {/* 旋转角度 */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs" style={{ color: "oklch(0.55 0.015 260)" }}>旋转角度</div>
              <button
                onClick={() => handleRotationChange(0)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs hover:opacity-80"
                style={{ background: "oklch(0.20 0.015 260)", color: "oklch(0.55 0.015 260)" }}
              >
                <RotateCcw size={9} /> 重置
              </button>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              step={0.5}
              value={selectedSlot.rotation ?? 0}
              onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
              className="w-full"
              style={{ accentColor: "oklch(0.62 0.20 45)" }}
            />
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={-180}
                max={180}
                step={1}
                value={selectedSlot.rotation ?? 0}
                onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
                onWheel={handleRotationWheel}
                className="flex-1 px-2 py-1 rounded text-xs text-right"
                style={{
                  background: "oklch(0.20 0.015 260)",
                  border: "1px solid oklch(0.62 0.20 45 / 0.4)",
                  color: "oklch(0.92 0.008 260)",
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none",
                }}
              />
              <span className="text-xs" style={{ color: "oklch(0.55 0.015 260)" }}>°</span>
              <span className="text-xs" style={{ color: "oklch(0.62 0.20 45)", fontFamily: "monospace" }}>
                {((selectedSlot.rotation ?? 0) > 0 ? "+" : "")}{(selectedSlot.rotation ?? 0).toFixed(1)}°
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 标签 */}
      <div>
        <div className="text-xs mb-1" style={{ color: "oklch(0.55 0.015 260)" }}>标签</div>
        <input
          type="text"
          value={selectedSlot.label ?? ""}
          onChange={(e) => updateSlot(selectedSlot.id, { label: e.target.value })}
          placeholder="图框标签（可选）"
          className="w-full px-2 py-1.5 rounded text-xs"
          style={{
            background: "oklch(0.20 0.015 260)",
            border: "1px solid oklch(1 0 0 / 0.1)",
            color: "oklch(0.92 0.008 260)",
            outline: "none",
          }}
        />
      </div>

      {/* 删除按钮 */}
      <button
        onClick={deleteSelectedSlot}
        className="w-full flex items-center justify-center gap-2 py-1.5 rounded text-xs transition-all"
        style={{
          background: "oklch(0.62 0.22 25 / 0.12)",
          border: "1px solid oklch(0.62 0.22 25 / 0.25)",
          color: "oklch(0.75 0.15 25)",
        }}
      >
        <Trash2 size={12} />
        删除此图框
      </button>
    </div>
  );
}

// ─── 坐标输入组件 ─────────────────────────────────────────
function CoordInput({
  label, value, onChange, step = 0.1, min = 0, max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-xs w-4 flex-shrink-0 mono-input"
        style={{ color: "oklch(0.58 0.22 264)" }}
      >
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        className="flex-1 px-2 py-1 rounded text-xs mono-input"
        style={{
          background: "oklch(0.20 0.015 260)",
          border: "1px solid oklch(1 0 0 / 0.1)",
          color: "oklch(0.92 0.008 260)",
          outline: "none",
          minWidth: 0,
        }}
      />
    </div>
  );
}

// ─── 方案管理区块 ─────────────────────────────────────────
function SchemesSection() {
  const { state, saveScheme, loadScheme, deleteScheme, renameScheme } = useStudio();
  const { schemes, activeSchemeId } = state;
  const [saveName, setSaveName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleSave = () => {
    const name = saveName.trim() || `方案 ${new Date().toLocaleDateString()}`;
    saveScheme(name);
    setSaveName("");
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      renameScheme(id, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div
      className="px-4 py-3 space-y-2"
      style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}
    >
      {/* 保存输入 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="方案名称..."
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="flex-1 px-2 py-1.5 rounded text-xs"
          style={{
            background: "oklch(0.20 0.015 260)",
            border: "1px solid oklch(1 0 0 / 0.1)",
            color: "oklch(0.92 0.008 260)",
            outline: "none",
          }}
        />
        <button
          onClick={handleSave}
          className="px-2.5 py-1.5 rounded text-xs flex items-center gap-1 transition-all"
          style={{
            background: "oklch(0.58 0.22 264 / 0.2)",
            border: "1px solid oklch(0.58 0.22 264 / 0.4)",
            color: "oklch(0.78 0.12 264)",
          }}
        >
          <Save size={11} />
          保存
        </button>
      </div>

      {/* 方案列表 */}
      {schemes.length === 0 ? (
        <div className="text-xs text-center py-2" style={{ color: "oklch(0.40 0.01 260)" }}>
          暂无保存方案
        </div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {schemes.map((scheme) => (
            <div
              key={scheme.id}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded transition-all",
                activeSchemeId === scheme.id
                  ? "bg-indigo-500/15 border border-indigo-500/30"
                  : "hover:bg-white/5"
              )}
            >
              {editingId === scheme.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(scheme.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 px-1.5 py-0.5 rounded text-xs"
                    style={{
                      background: "oklch(0.20 0.015 260)",
                      border: "1px solid oklch(0.58 0.22 264 / 0.5)",
                      color: "oklch(0.92 0.008 260)",
                      outline: "none",
                    }}
                  />
                  <button onClick={() => handleRename(scheme.id)}>
                    <Check size={11} style={{ color: "oklch(0.65 0.18 145)" }} />
                  </button>
                  <button onClick={() => setEditingId(null)}>
                    <X size={11} style={{ color: "oklch(0.55 0.015 260)" }} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="flex-1 text-left text-xs truncate"
                    style={{ color: activeSchemeId === scheme.id ? "oklch(0.78 0.12 264)" : "oklch(0.75 0.01 260)" }}
                    onClick={() => loadScheme(scheme)}
                  >
                    {scheme.name}
                  </button>
                  <button
                    onClick={() => { setEditingId(scheme.id); setEditName(scheme.name); }}
                    className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                  >
                    <Pencil size={10} style={{ color: "oklch(0.55 0.015 260)" }} />
                  </button>
                  <button
                    onClick={() => deleteScheme(scheme.id)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={10} style={{ color: "oklch(0.55 0.015 260)" }} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 懒加载缩略图子组件 ─────────────────────────────────────────
function LazyThumbnail({ entry }: { entry: TemplateIndex }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([io]) => {
        if (io.isIntersecting && !thumb && !loading) {
          setLoading(true);
          loadTemplateDetail(entry.id).then((tpl) => {
            if (!tpl) { setLoading(false); return; }
            getThumbnail(entry.id, tpl)
              .then((url) => { setThumb(url); setLoading(false); })
              .catch(() => setLoading(false));
          }).catch(() => setLoading(false));
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  return (
    <div
      ref={ref}
      className="w-full relative overflow-hidden"
      style={{ height: "72px", background: "oklch(0.13 0.01 260)" }}
    >
      {thumb ? (
        <img src={thumb} alt={entry.name} className="w-full h-full object-cover" style={{ opacity: 0.9 }} />
      ) : loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 size={16} className="animate-spin" style={{ color: "oklch(0.45 0.01 260)" }} />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <LayoutTemplate size={18} style={{ color: "oklch(0.35 0.01 260)" }} />
        </div>
      )}
      <div
        className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-xs"
        style={{
          background: "oklch(0 0 0 / 0.65)",
          color: "oklch(0.85 0.008 260)",
          fontSize: "0.6rem",
          backdropFilter: "blur(4px)",
        }}
      >
        {entry.slotCount} 框
      </div>
    </div>
  );
}

// ─── 模板管理区块 ─────────────────────────────────────────────
function TemplatesSection() {
  const {
    state,
    saveAsTemplate,
    importTemplate,
    savedTemplates,
    loadTemplateFromLibrary,
    deleteTemplateFromLibrary,
    renameTemplate,
  } = useStudio();
  const { canvas, slots } = state;
  const importRef = useRef<HTMLInputElement>(null);
  const [tplName, setTplName] = useState("");
  const [tplAuthor, setTplAuthor] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 虚拟滚动容器
  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: savedTemplates.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 200, // 每个模板卡片预估高度
    overscan: 3,
  });

  const handleSave = () => {
    const name = tplName.trim() || `模板-${canvas.width}×${canvas.height}`;
    saveAsTemplate(name, tplAuthor.trim() || undefined);
    setTplName("");
    setTplAuthor("");
    setShowSaveForm(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importTemplate(file);
    e.target.value = "";
  };

  const handleRenameConfirm = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) renameTemplate(id, trimmed);
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div
      className="px-4 py-3 space-y-3"
      style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}
    >
      {/* 操作按钮行 */}
      <div className="flex gap-2">
        {/* 导入模板 */}
        <button
          onClick={() => importRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium transition-all"
          style={{
            background: "oklch(0.58 0.22 264 / 0.12)",
            border: "1px solid oklch(0.58 0.22 264 / 0.3)",
            color: "oklch(0.72 0.12 264)",
          }}
          title="导入 .json 模板文件（自动保存到模板库）"
        >
          <Upload size={12} />
          导入模板
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImport}
        />

        {/* 另存为模板 */}
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          disabled={slots.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: showSaveForm
              ? "oklch(0.65 0.18 145 / 0.25)"
              : "oklch(0.65 0.18 145 / 0.12)",
            border: "1px solid oklch(0.65 0.18 145 / 0.3)",
            color: "oklch(0.75 0.14 145)",
          }}
          title="将当前画布（底图+图框）另存为模板文件"
        >
          <Save size={12} />
          另存模板
        </button>
      </div>

      {/* 另存为表单 */}
      {showSaveForm && (
        <div
          className="rounded-lg p-3 space-y-2"
          style={{
            background: "oklch(0.18 0.018 260)",
            border: "1px solid oklch(0.65 0.18 145 / 0.2)",
          }}
        >
          <div className="text-xs font-medium" style={{ color: "oklch(0.75 0.14 145)" }}>另存为模板文件</div>
          <input
            type="text"
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            placeholder="模板名称（必填）"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full px-2 py-1.5 rounded text-xs"
            style={{
              background: "oklch(0.20 0.015 260)",
              border: "1px solid oklch(0.65 0.18 145 / 0.4)",
              color: "oklch(0.92 0.008 260)",
              outline: "none",
            }}
          />
          <input
            type="text"
            value={tplAuthor}
            onChange={(e) => setTplAuthor(e.target.value)}
            placeholder="店家/作者名（可选）"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full px-2 py-1.5 rounded text-xs"
            style={{
              background: "oklch(0.20 0.015 260)",
              border: "1px solid oklch(1 0 0 / 0.1)",
              color: "oklch(0.92 0.008 260)",
              outline: "none",
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveForm(false)}
              className="flex-1 py-1.5 rounded text-xs transition-all"
              style={{
                background: "oklch(0.22 0.02 260)",
                border: "1px solid oklch(1 0 0 / 0.08)",
                color: "oklch(0.60 0.01 260)",
              }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all"
              style={{
                background: "oklch(0.65 0.18 145)",
                color: "oklch(0.12 0.01 145)",
              }}
            >
              <Save size={11} />
              下载
            </button>
          </div>
          <div className="text-xs" style={{ color: "oklch(0.40 0.01 260)", fontSize: "0.65rem" }}>
            底图 + 图框打包为 .json 文件，分享给用户后可直接导入使用
          </div>
        </div>
      )}

      {/* 分隔线 */}
      <div style={{ borderTop: "1px solid oklch(1 0 0 / 0.08)" }} />

      {/* 模板库列表 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium" style={{ color: "oklch(0.65 0.015 260)" }}>
            我的模板库
          </div>
          <div
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              background: savedTemplates.length > 0 ? "oklch(0.58 0.22 264 / 0.15)" : "oklch(1 0 0 / 0.05)",
              color: savedTemplates.length > 0 ? "oklch(0.72 0.12 264)" : "oklch(0.45 0.01 260)",
              fontSize: "0.65rem",
            }}
          >
            {savedTemplates.length} 个
          </div>
        </div>

        {savedTemplates.length === 0 ? (
          <div
            className="rounded-lg py-5 flex flex-col items-center gap-2"
            style={{
              background: "oklch(0.17 0.015 260)",
              border: "1px dashed oklch(1 0 0 / 0.1)",
            }}
          >
            <Bookmark size={18} style={{ color: "oklch(0.40 0.01 260)" }} />
            <div className="text-xs text-center" style={{ color: "oklch(0.45 0.01 260)" }}>
              暂无模板
              <br />
              <span style={{ fontSize: "0.65rem", color: "oklch(0.38 0.01 260)" }}>
                导入 .json 文件后自动保存到此处
              </span>
            </div>
          </div>
        ) : (
          /* 虚拟滚动容器：固定高度，只渲染可见区域内的卡片 */
          <div
            ref={listRef}
            style={{ height: "420px", overflowY: "auto", overflowX: "hidden" }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const entry = savedTemplates[virtualRow.index];
                return (
                  <div
                    key={entry.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: "8px",
                    }}
                  >
                    <div
                      className="rounded-lg overflow-hidden transition-all"
                      style={{
                        background: "oklch(0.17 0.015 260)",
                        border: "1px solid oklch(1 0 0 / 0.08)",
                      }}
                    >
                      {/* 懒加载缩略图 */}
                      <LazyThumbnail entry={entry} />

                      {/* 模板信息 */}
                      <div className="px-2.5 py-2">
                        {renamingId === entry.id ? (
                          <div className="flex gap-1 mb-1.5">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameConfirm(entry.id);
                                if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                              }}
                              autoFocus
                              className="flex-1 px-1.5 py-1 rounded text-xs"
                              style={{
                                background: "oklch(0.20 0.015 260)",
                                border: "1px solid oklch(0.58 0.22 264 / 0.4)",
                                color: "oklch(0.92 0.008 260)",
                                outline: "none",
                              }}
                            />
                            <button
                              onClick={() => handleRenameConfirm(entry.id)}
                              className="px-1.5 py-1 rounded text-xs"
                              style={{ background: "oklch(0.58 0.22 264 / 0.2)", color: "oklch(0.72 0.12 264)" }}
                            >
                              <Check size={11} />
                            </button>
                            <button
                              onClick={() => { setRenamingId(null); setRenameValue(""); }}
                              className="px-1.5 py-1 rounded text-xs"
                              style={{ background: "oklch(1 0 0 / 0.05)", color: "oklch(0.55 0.01 260)" }}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-xs font-medium truncate"
                                style={{ color: "oklch(0.88 0.008 260)" }}
                              >
                                {entry.name}
                              </div>
                              {entry.author && (
                                <div
                                  className="text-xs truncate mt-0.5"
                                  style={{ color: "oklch(0.50 0.01 260)", fontSize: "0.65rem" }}
                                >
                                  {entry.author}
                                </div>
                              )}
                              <div
                                className="text-xs mt-0.5"
                                style={{ color: "oklch(0.42 0.01 260)", fontSize: "0.6rem" }}
                              >
                                {entry.width}×{entry.height}px
                                {" · "}
                                {new Date(entry.importedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                              </div>
                            </div>
                            <button
                              onClick={() => { setRenamingId(entry.id); setRenameValue(entry.name); }}
                              className="p-1 rounded flex-shrink-0 transition-all"
                              style={{ color: "oklch(0.45 0.01 260)" }}
                              title="重命名"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}

                        {/* 操作按鈕 */}
                        {confirmDeleteId === entry.id ? (
                          <div className="flex gap-1">
                            <div className="flex-1 text-xs" style={{ color: "oklch(0.75 0.18 25)", fontSize: "0.65rem", lineHeight: 1.4 }}>
                              确认删除？此操作不可撤销
                            </div>
                            <button
                              onClick={() => { deleteTemplateFromLibrary(entry.id); setConfirmDeleteId(null); }}
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ background: "oklch(0.55 0.22 25 / 0.2)", color: "oklch(0.75 0.18 25)" }}
                            >
                              删除
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded text-xs"
                              style={{ background: "oklch(1 0 0 / 0.05)", color: "oklch(0.55 0.01 260)" }}
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => loadTemplateFromLibrary(entry.id)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-all"
                              style={{
                                background: "oklch(0.58 0.22 264 / 0.15)",
                                border: "1px solid oklch(0.58 0.22 264 / 0.25)",
                                color: "oklch(0.72 0.12 264)",
                              }}
                            >
                              <FolderOpen size={11} />
                              加载
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(entry.id)}
                              className="px-2 py-1.5 rounded text-xs transition-all"
                              style={{
                                background: "oklch(0.55 0.22 25 / 0.08)",
                                border: "1px solid oklch(0.55 0.22 25 / 0.2)",
                                color: "oklch(0.65 0.18 25)",
                              }}
                              title="从模板库删除"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-xs mt-2" style={{ color: "oklch(0.38 0.01 260)", fontSize: "0.62rem", lineHeight: 1.5 }}>
          模板库自动保存到本地，关闭浏览器或重启电脑后仍然存在
        </div>
      </div>
    </div>
  );
}

// ─── 图层管理区块 ─────────────────────────────────────────────
function LayerPanel() {
  const {
    state: { slots, selectedSlotId, selectedSlotIds },
    selectSlot,
    selectSlots,
    reorderSlot,
    duplicateSlot,
  } = useStudio();

  if (slots.length === 0) {
    return (
      <div
        className="px-4 py-4 text-center"
        style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}
      >
        <div className="text-xs" style={{ color: "oklch(0.45 0.01 260)" }}>
          画布上还没有图框
        </div>
      </div>
    );
  }

  // 图层顺序：数组末尾 = 最顶层，反转显示（顶层在上）
  const reversedSlots = [...slots].reverse();

  return (
    <div
      className="px-3 py-3 space-y-1"
      style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}
    >
      <div className="text-xs mb-2" style={{ color: "oklch(0.50 0.01 260)", fontSize: "0.65rem" }}>
        顶层在上 · 点击选中 · Shift+点击多选
      </div>
      {reversedSlots.map((slot, revIdx) => {
        const isSelected = slot.id === selectedSlotId;
        const isMultiSelected = selectedSlotIds.includes(slot.id);
        const originalIdx = slots.indexOf(slot);
        const isTop = originalIdx === slots.length - 1;
        const isBottom = originalIdx === 0;
        return (
          <div
            key={slot.id}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-all",
              isSelected
                ? "bg-indigo-500/20 border border-indigo-500/40"
                : isMultiSelected
                ? "bg-amber-500/15 border border-amber-500/30"
                : "hover:bg-white/5 border border-transparent"
            )}
            onClick={(e) => {
              if (e.shiftKey) {
                const newIds = selectedSlotIds.includes(slot.id)
                  ? selectedSlotIds.filter((id) => id !== slot.id)
                  : [...selectedSlotIds, slot.id];
                selectSlots(newIds);
                selectSlot(newIds.length === 1 ? newIds[0] : null);
              } else {
                selectSlot(slot.id);
                selectSlots([slot.id]);
              }
            }}
          >
            {/* 图层序号 */}
            <div
              className="w-4 text-center flex-shrink-0"
              style={{ color: "oklch(0.40 0.01 260)", fontSize: "0.6rem", fontFamily: "monospace" }}
            >
              {originalIdx + 1}
            </div>

            {/* 图层名称 */}
            <div className="flex-1 min-w-0">
              <div
                className="text-xs truncate"
                style={{
                  color: isSelected
                    ? "oklch(0.82 0.12 264)"
                    : isMultiSelected
                    ? "oklch(0.82 0.12 55)"
                    : "oklch(0.72 0.01 260)",
                }}
              >
                {slot.label || `图框 ${originalIdx + 1}`}
              </div>
              <div
                className="text-xs"
                style={{ color: "oklch(0.42 0.01 260)", fontSize: "0.6rem" }}
              >
                {slot.w.toFixed(1)}% × {slot.h.toFixed(1)}%
                {slot.assetId && (
                  <span style={{ color: "oklch(0.65 0.18 145)", marginLeft: 4 }}>● 已填充</span>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                title="上移一层"
                disabled={isTop}
                onClick={(e) => { e.stopPropagation(); reorderSlot(slot.id, "up"); }}
                className="p-0.5 rounded transition-all disabled:opacity-25"
                style={{ color: "oklch(0.55 0.01 260)" }}
              >
                <ArrowUp size={11} />
              </button>
              <button
                title="下移一层"
                disabled={isBottom}
                onClick={(e) => { e.stopPropagation(); reorderSlot(slot.id, "down"); }}
                className="p-0.5 rounded transition-all disabled:opacity-25"
                style={{ color: "oklch(0.55 0.01 260)" }}
              >
                <ArrowDown size={11} />
              </button>
              <button
                title="置顶"
                disabled={isTop}
                onClick={(e) => { e.stopPropagation(); reorderSlot(slot.id, "top"); }}
                className="p-0.5 rounded transition-all disabled:opacity-25"
                style={{ color: "oklch(0.55 0.01 260)" }}
              >
                <ChevronsUp size={11} />
              </button>
              <button
                title="置底"
                disabled={isBottom}
                onClick={(e) => { e.stopPropagation(); reorderSlot(slot.id, "bottom"); }}
                className="p-0.5 rounded transition-all disabled:opacity-25"
                style={{ color: "oklch(0.55 0.01 260)" }}
              >
                <ChevronsDown size={11} />
              </button>
              <button
                title="复制图框 (Ctrl+D)"
                onClick={(e) => { e.stopPropagation(); duplicateSlot(slot.id); }}
                className="p-0.5 rounded transition-all"
                style={{ color: "oklch(0.55 0.01 260)" }}
              >
                <Copy size={11} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 预设模板区块 ─────────────────────────────────────────────
function PresetsSection() {
  const { loadPreset } = useStudio();

  return (
    <div
      className="px-4 py-3 space-y-1.5"
      style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}
    >
      {PRESET_TEMPLATES.map((preset) => (
        <button
          key={preset.id}
          onClick={() => loadPreset(preset.id)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all group"
          style={{
            background: "oklch(0.20 0.015 260 / 0.6)",
            border: "1px solid oklch(1 0 0 / 0.06)",
          }}
        >
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-medium truncate"
              style={{ color: "oklch(0.82 0.01 260)" }}
            >
              {preset.name}
            </div>
            <div className="text-xs truncate" style={{ color: "oklch(0.50 0.01 260)" }}>
              {preset.description} · {preset.canvas.width}×{preset.canvas.height}
            </div>
          </div>
          <div
            className="text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: "oklch(0.58 0.22 264 / 0.2)",
              color: "oklch(0.78 0.12 264)",
            }}
          >
            加载
          </div>
        </button>
      ))}
    </div>
  );
}
