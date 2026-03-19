// ============================================================
// 奇妙奇遇光影集 排版 Studio — 右侧素材库面板
// Design: 专业暗夜工作台 — 访达风格素材管理
// 功能: 照片上传、文件夹管理（访达逻辑）、填入/裁剪/拖拽
//       Win 风格蓝色框选批量选中、拖拽归入文件夹
// ============================================================
import React, { useRef, useCallback, useState, useEffect } from "react";
import { useStudio } from "@/contexts/StudioContext";
import {
  Upload, Trash2, Image, Zap, X, CheckCircle2, Crop,
  FolderPlus, FolderOpen, ChevronRight, Home,
} from "lucide-react";
import { toast } from "sonner";
import CropModal from "./CropModal";
import type { Asset } from "@/lib/types";

interface AssetFolder {
  id: string;
  name: string;
  assetIds: string[];
}

const FOLDERS_KEY = "asset-folders-v2";
function loadFolders(): AssetFolder[] {
  try {
    const saved = localStorage.getItem(FOLDERS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}
function persistFolders(folders: AssetFolder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

// ─── 框选状态 ─────────────────────────────────────────────
interface RubberBand {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function RightPanel() {
  const {
    state,
    uploadAssets,
    removeAsset,
    removeAssets,
    fillSlot,
    unfillSlot,
    autoFill,
    autoFillOrdered,
    updateAsset,
    updateSlot,
  } = useStudio();
  const { assets, slots, selectedSlotId } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [cropTarget, setCropTarget] = useState<Asset | null>(null);

  // ─── 文件夹状态 ───────────────────────────────────────────
  const [folders, setFolders] = useState<AssetFolder[]>(loadFolders);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ─── 选中状态 ─────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ─── Win 风格框选 ─────────────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null);
  const [rubberBand, setRubberBand] = useState<RubberBand | null>(null);
  const rubberRef = useRef<RubberBand | null>(null);
  const isDraggingRubber = useRef(false);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const saveFolders = (updated: AssetFolder[]) => {
    setFolders(updated);
    persistFolders(updated);
  };

  const createFolder = () => {
    const name = newFolderName.trim();
    setCreatingFolder(false);
    setNewFolderName("");
    if (!name) return;
    const newFolder: AssetFolder = { id: `folder-${Date.now()}`, name, assetIds: [] };
    saveFolders([...folders, newFolder]);
    toast.success(`文件夹「${name}」已创建`);
  };

  const deleteFolder = (folderId: string) => {
    saveFolders(folders.filter((f) => f.id !== folderId));
    if (currentFolderId === folderId) setCurrentFolderId(null);
  };

  const startRename = (folder: AssetFolder) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  };

  const confirmRename = () => {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (name) saveFolders(folders.map((f) => f.id === renamingId ? { ...f, name } : f));
    setRenamingId(null);
  };

  const moveAssetToFolder = (assetId: string, folderId: string) => {
    const updated = folders.map((f) => {
      if (f.id === folderId) {
        if (f.assetIds.includes(assetId)) return f;
        return { ...f, assetIds: [...f.assetIds, assetId] };
      }
      return { ...f, assetIds: f.assetIds.filter((id) => id !== assetId) };
    });
    saveFolders(updated);
  };

  const moveSelectedToFolder = (folderId: string) => {
    if (selectedIds.size === 0) return;
    let updated = [...folders];
    selectedIds.forEach((assetId) => {
      updated = updated.map((f) => {
        if (f.id === folderId) {
          if (f.assetIds.includes(assetId)) return f;
          return { ...f, assetIds: [...f.assetIds, assetId] };
        }
        return { ...f, assetIds: f.assetIds.filter((id) => id !== assetId) };
      });
    });
    saveFolders(updated);
    toast.success(`已将 ${selectedIds.size} 张图片移入文件夹`);
    setSelectedIds(new Set());
  };

  const removeFromFolder = (assetId: string) => {
    saveFolders(folders.map((f) => ({
      ...f,
      assetIds: f.assetIds.filter((id) => id !== assetId),
    })));
  };

  const currentFolder = folders.find((f) => f.id === currentFolderId) ?? null;
  const assetsInAnyFolder = new Set(folders.flatMap((f) => f.assetIds));

  type ViewItem =
    | { type: "folder"; folder: AssetFolder }
    | { type: "asset"; asset: Asset };

  const viewItems: ViewItem[] =
    currentFolderId === null
      ? [
          ...folders.map((f): ViewItem => ({ type: "folder", folder: f })),
          ...assets
            .filter((a) => !assetsInAnyFolder.has(a.id))
            .map((a): ViewItem => ({ type: "asset", asset: a })),
        ]
      : [
          // 在文件夹内时，顶部显示其他文件夹，方便跨文件夹拖拽移动
          ...folders
            .filter((f) => f.id !== currentFolderId)
            .map((f): ViewItem => ({ type: "folder", folder: f })),
          ...assets
            .filter((a) => currentFolder?.assetIds.includes(a.id))
            .map((a): ViewItem => ({ type: "asset", asset: a })),
        ];

  // ─── Win 框选逻辑 ─────────────────────────────────────────
  const getGridRect = () => gridRef.current?.getBoundingClientRect();

  const getIntersectingAssets = useCallback((rb: RubberBand): Set<string> => {
    const grid = getGridRect();
    if (!grid) return new Set();
    const selLeft = Math.min(rb.startX, rb.currentX);
    const selTop = Math.min(rb.startY, rb.currentY);
    const selRight = Math.max(rb.startX, rb.currentX);
    const selBottom = Math.max(rb.startY, rb.currentY);

    const result = new Set<string>();
    itemRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      const itemLeft = rect.left - grid.left;
      const itemTop = rect.top - grid.top;
      const itemRight = rect.right - grid.left;
      const itemBottom = rect.bottom - grid.top;
      // 相交判断
      if (
        itemLeft < selRight &&
        itemRight > selLeft &&
        itemTop < selBottom &&
        itemBottom > selTop
      ) {
        result.add(id);
      }
    });
    return result;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRubber.current || !rubberRef.current) return;
      const grid = getGridRect();
      if (!grid) return;
      const currentX = e.clientX - grid.left;
      const currentY = e.clientY - grid.top + (gridRef.current?.scrollTop ?? 0);
      const updated = { ...rubberRef.current, currentX, currentY };
      rubberRef.current = updated;
      setRubberBand({ ...updated });
      // 实时更新选中
      setSelectedIds(getIntersectingAssets(updated));
    };

    const handleMouseUp = () => {
      if (!isDraggingRubber.current) return;
      isDraggingRubber.current = false;
      rubberRef.current = null;
      setRubberBand(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [getIntersectingAssets]);

  const handleGridMouseDown = (e: React.MouseEvent) => {
    // 只在直接点击空白区域时触发框选（不是点击卡片）
    if ((e.target as HTMLElement).closest("[data-item]")) return;
    if (e.button !== 0) return;
    const grid = getGridRect();
    if (!grid) return;
    const startX = e.clientX - grid.left;
    const startY = e.clientY - grid.top + (gridRef.current?.scrollTop ?? 0);
    const rb: RubberBand = { startX, startY, currentX: startX, currentY: startY };
    rubberRef.current = rb;
    isDraggingRubber.current = true;
    setRubberBand(rb);
    setSelectedIds(new Set()); // 开始新框选时清空
    e.preventDefault();
  };  // ─── 上传（如果在文件夹内，直接归入当前文件夹） ─────────────────────────
  const assignToCurrentFolder = useCallback((newAssets: Asset[]) => {
    if (!currentFolderId || newAssets.length === 0) return;
    setFolders((prev) => {
      const updated = prev.map((f) =>
        f.id === currentFolderId
          ? { ...f, assetIds: [...f.assetIds, ...newAssets.map((a) => a.id).filter((id) => !f.assetIds.includes(id))] }
          : f
      );
      persistFolders(updated);
      return updated;
    });
  }, [currentFolderId]);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const newAssets = await uploadAssets(e.target.files);
      assignToCurrentFolder(newAssets);
    }
    e.target.value = "";
  };
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length) {
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (imageFiles.length === 0) { toast.error("请上传图片文件（JPG/PNG/WebP 等）"); return; }
        const dt = new DataTransfer();
        imageFiles.forEach((f) => dt.items.add(f));
        const newAssets = await uploadAssets(dt.files);
        assignToCurrentFolder(newAssets);
      }
    },
    [uploadAssets, assignToCurrentFolder]
  );
  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    // 如果有多选，批量移入
    if (selectedIds.size > 0) {
      moveSelectedToFolder(folderId);
      return;
    }
    const assetId = e.dataTransfer.getData("assetId");
    if (!assetId) return;
    moveAssetToFolder(assetId, folderId);
    toast.success("已移入文件夹");
  };

  const handleFillClick = (assetId: string) => {
    if (!selectedSlotId) { toast.warning("请先在画布上点选一个图框，再点击填入"); return; }
    fillSlot(selectedSlotId, assetId);
    toast.success("已填入图框");
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    removeAssets(Array.from(selectedIds));
    saveFolders(folders.map((f) => ({ ...f, assetIds: f.assetIds.filter((id) => !selectedIds.has(id)) })));
    setSelectedIds(new Set());
    toast.success(`已删除 ${selectedIds.size} 张图片`);
  };

  const filledCount = slots.filter((s) => s.assetId !== null).length;
  const emptyCount = slots.filter((s) => s.assetId === null).length;

  // 框选矩形的屏幕坐标（相对于 grid 容器）
  const rubberStyle = rubberBand
    ? {
        left: Math.min(rubberBand.startX, rubberBand.currentX),
        top: Math.min(rubberBand.startY, rubberBand.currentY),
        width: Math.abs(rubberBand.currentX - rubberBand.startX),
        height: Math.abs(rubberBand.currentY - rubberBand.startY),
      }
    : null;

  return (
    <>
      {cropTarget && (
        <CropModal
          asset={cropTarget}
          onConfirm={(updated) => {
            updateAsset(updated.id, { croppedDataUrl: updated.croppedDataUrl, cropRect: updated.cropRect });
            setCropTarget(null);
            toast.success("裁剪完成！可拖拽或点击填入图框");
          }}
          onCancel={() => setCropTarget(null)}
        />
      )}

      <div
        className="flex flex-col flex-shrink-0 h-full"
        style={{ width: "256px", background: "oklch(0.14 0.015 260)", borderLeft: "1px solid oklch(1 0 0 / 0.07)" }}
      >
        {/* 顶部标题 */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "oklch(0.55 0.015 260)", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.1em" }}>
              素材库
            </span>
            <span className="text-xs" style={{ color: "oklch(0.45 0.01 260)", fontFamily: "monospace", fontSize: "0.7rem" }}>
              {assets.length} 张
            </span>
          </div>

          {slots.length > 0 && (
            <div className="flex gap-3">
              <div className="flex items-center gap-1">
                <CheckCircle2 size={10} style={{ color: "oklch(0.65 0.18 145)" }} />
                <span style={{ color: "oklch(0.65 0.18 145)", fontFamily: "monospace", fontSize: "0.7rem" }}>{filledCount} 已填</span>
              </div>
              {emptyCount > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm border" style={{ borderColor: "oklch(0.58 0.22 264 / 0.5)" }} />
                  <span style={{ color: "oklch(0.50 0.01 260)", fontFamily: "monospace", fontSize: "0.7rem" }}>{emptyCount} 空置</span>
                </div>
              )}
            </div>
          )}

          {selectedSlotId && (() => {
            const selectedSlot = slots.find(s => s.id === selectedSlotId);
            const slotHasImage = !!selectedSlot?.assetId;
            return (
              <>
                <div className="mt-1.5 px-2 py-1 rounded flex items-center gap-1.5"
                  style={{ background: "oklch(0.58 0.22 264 / 0.12)", border: "1px solid oklch(0.58 0.22 264 / 0.25)", color: "oklch(0.72 0.12 264)" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span style={{ fontSize: "0.7rem" }}>
                    {slotHasImage ? "图框已选中 · 双击调节图片" : "图框已选中 · 点击图片操作"}
                  </span>
                </div>
                {slotHasImage && selectedSlot && (
                  <div className="mt-1.5 px-2 py-1.5 rounded"
                    style={{ background: "oklch(0.65 0.20 145 / 0.08)", border: "1px solid oklch(0.65 0.20 145 / 0.2)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontSize: "0.65rem", color: "oklch(0.65 0.20 145)", fontWeight: 600, letterSpacing: "0.05em" }}>图片变换</span>
                      <button
                        onClick={() => updateSlot(selectedSlotId, { offsetX: 0, offsetY: 0, scale: 1, rotation: 0 })}
                        style={{ fontSize: "0.6rem", color: "oklch(0.65 0.20 145)", background: "oklch(0.65 0.20 145 / 0.15)", borderRadius: 3, padding: "1px 6px", border: "1px solid oklch(0.65 0.20 145 / 0.3)", cursor: "pointer" }}
                      >
                        重置
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-center">
                        <div style={{ fontSize: "0.58rem", color: "oklch(0.45 0.01 260)", marginBottom: 2 }}>X偏移</div>
                        <div style={{ fontSize: "0.68rem", color: "oklch(0.78 0.08 260)", fontFamily: "monospace" }}>{(selectedSlot.offsetX ?? 0).toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: "0.58rem", color: "oklch(0.45 0.01 260)", marginBottom: 2 }}>Y偏移</div>
                        <div style={{ fontSize: "0.68rem", color: "oklch(0.78 0.08 260)", fontFamily: "monospace" }}>{(selectedSlot.offsetY ?? 0).toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: "0.58rem", color: "oklch(0.45 0.01 260)", marginBottom: 2 }}>缩放</div>
                        <div style={{ fontSize: "0.68rem", color: "oklch(0.78 0.08 260)", fontFamily: "monospace" }}>{((selectedSlot.scale ?? 1) * 100).toFixed(0)}%</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: "0.58rem", color: "oklch(0.45 0.01 260)", marginBottom: 2 }}>旋转</div>
                        <div style={{ fontSize: "0.68rem", color: "oklch(0.78 0.08 260)", fontFamily: "monospace" }}>{Math.round(selectedSlot.rotation ?? 0)}°</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.58rem", color: "oklch(0.40 0.01 260)", marginTop: 4, textAlign: "center" }}>
                      双击图框进入调节模式，Shift+滚轮旋转
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {selectedIds.size > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span style={{ color: "oklch(0.72 0.12 264)", fontSize: "0.7rem", fontWeight: 600 }}>
                已选 {selectedIds.size} 张
              </span>
              <button onClick={() => setSelectedIds(new Set())}
                className="px-1.5 py-0.5 rounded"
                style={{ background: "oklch(1 0 0 / 0.06)", color: "oklch(0.50 0.01 260)", fontSize: "0.65rem" }}>
                清除
              </button>
              <button onClick={handleBatchDelete}
                className="px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{ background: "oklch(0.55 0.22 25 / 0.2)", color: "oklch(0.75 0.18 25)", fontSize: "0.65rem" }}>
                <Trash2 size={9} /> 删除
              </button>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="px-3 py-2 flex gap-2 flex-shrink-0" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs transition-all"
            style={{ background: "oklch(0.58 0.22 264 / 0.15)", border: "1px solid oklch(0.58 0.22 264 / 0.3)", color: "oklch(0.75 0.12 264)" }}>
            <Upload size={12} /> 上传照片
          </button>
          <button
            onClick={() => {
              // 按当前文件夹顺序填充：当前文件夹内的图片按显示顺序，根目录则所有未分组图片
              const orderedAssets = viewItems
                .filter((item): item is { type: "asset"; asset: Asset } => item.type === "asset")
                .map((item) => item.asset.id);
              if (orderedAssets.length > 0) {
                autoFillOrdered(orderedAssets);
              } else {
                autoFill();
              }
            }}
            disabled={emptyCount === 0 || assets.length === 0}
            title={currentFolderId ? `按「${currentFolder?.name}」文件夹顺序填充图框` : "按当前素材库顺序填充图框"}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs transition-all disabled:opacity-35"
            style={{ background: "oklch(0.62 0.20 45 / 0.15)", border: "1px solid oklch(0.62 0.20 45 / 0.3)", color: "oklch(0.80 0.14 55)" }}>
            <Zap size={12} /> 自动填充
          </button>
        </div>

        {/* 面包屑导航 */}
        <div className="px-3 py-1.5 flex items-center gap-1 flex-shrink-0"
          style={{ borderBottom: "1px solid oklch(1 0 0 / 0.05)", minHeight: "28px" }}>
          <button onClick={() => setCurrentFolderId(null)}
            className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors"
            style={{ color: currentFolderId ? "oklch(0.58 0.22 264)" : "oklch(0.65 0.01 260)", fontSize: "0.7rem" }}>
            <Home size={11} /><span>素材库</span>
          </button>
          {currentFolder && (
            <>
              <ChevronRight size={10} style={{ color: "oklch(0.38 0.01 260)", flexShrink: 0 }} />
              <span style={{ color: "oklch(0.72 0.01 260)", fontSize: "0.7rem" }} className="truncate">
                {currentFolder.name}
              </span>
            </>
          )}
          {currentFolderId === null && (
            <button
              onClick={() => { setCreatingFolder(true); setTimeout(() => newFolderInputRef.current?.focus(), 50); }}
              className="ml-auto p-1 rounded transition-colors"
              title="新建文件夹"
              style={{ color: "oklch(0.45 0.01 260)" }}
            >
              <FolderPlus size={13} />
            </button>
          )}
        </div>

        {/* 新建文件夹输入 */}
        {creatingFolder && (
          <div className="px-3 py-2 flex items-center gap-2 flex-shrink-0"
            style={{ borderBottom: "1px solid oklch(1 0 0 / 0.05)" }}>
            <FolderOpen size={13} style={{ color: "oklch(0.72 0.16 55)", flexShrink: 0 }} />
            <input
              ref={newFolderInputRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder();
                if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
              }}
              onBlur={createFolder}
              placeholder="文件夹名称"
              className="flex-1 bg-transparent outline-none"
              style={{ color: "oklch(0.85 0.01 260)", fontSize: "0.75rem", borderBottom: "1px solid oklch(0.58 0.22 264 / 0.5)" }}
            />
          </div>
        )}

        {/* 提示文字 */}
        {assets.length > 0 && !currentFolderId && (
          <div className="px-3 py-1 flex-shrink-0">
            <span style={{ color: "oklch(0.38 0.01 260)", fontSize: "0.62rem" }}>
              拖拽框选批量选中 · 拖入文件夹归类
            </span>
          </div>
        )}

        {/* 内容区（访达风格混排 + Win框选） */}
        <div
          ref={gridRef}
          className="flex-1 overflow-y-auto p-2 relative select-none"
          onMouseDown={handleGridMouseDown}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          style={{ cursor: rubberBand ? "crosshair" : "default" }}
        >
          {/* Win 风格蓝色框选矩形 */}
          {rubberStyle && (
            <div
              className="absolute pointer-events-none z-50"
              style={{
                left: rubberStyle.left,
                top: rubberStyle.top,
                width: rubberStyle.width,
                height: rubberStyle.height,
                background: "oklch(0.58 0.22 264 / 0.15)",
                border: "1.5px solid oklch(0.58 0.22 264 / 0.8)",
                borderRadius: "2px",
              }}
            />
          )}

          {viewItems.length === 0 ? (
            <div
              className="h-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed min-h-40 transition-all"
              style={{
                borderColor: isDragOver ? "oklch(0.58 0.22 264 / 0.6)" : "oklch(0.58 0.22 264 / 0.2)",
                background: isDragOver ? "oklch(0.58 0.22 264 / 0.06)" : "transparent",
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.20 0.015 260)" }}>
                <Image size={20} style={{ color: "oklch(0.40 0.01 260)" }} />
              </div>
              <div className="text-center px-4">
                <div className="text-xs font-medium mb-1" style={{ color: "oklch(0.55 0.01 260)" }}>
                  {currentFolderId ? "此文件夹暂无照片" : "拖拽图片到此处"}
                </div>
                <div className="text-xs" style={{ color: "oklch(0.38 0.01 260)" }}>
                  {currentFolderId ? "从外部拖入图片或上传" : "或点击上方「上传照片」按钮"}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {viewItems.map((item) => {
                if (item.type === "folder") {
                  const folder = item.folder;
                  const count = folder.assetIds.filter((id) => assets.some((a) => a.id === id)).length;
                  const isOver = dragOverFolderId === folder.id;
                  // 如果有多选素材，拖入文件夹时高亮
                  const isDropTarget = isOver;
                  return (
                    <div
                      key={folder.id}
                      data-item="folder"
                      className="relative group rounded-lg p-2 flex flex-col items-center gap-1 cursor-pointer transition-all"
                      style={{
                        background: isDropTarget ? "oklch(0.65 0.18 145 / 0.12)" : "oklch(0.18 0.015 260)",
                        border: isDropTarget ? "1.5px dashed oklch(0.65 0.18 145 / 0.7)" : "1.5px solid oklch(1 0 0 / 0.07)",
                      }}
                      onDoubleClick={() => setCurrentFolderId(folder.id)}
                      onDrop={(e) => handleFolderDrop(e, folder.id)}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolderId(folder.id); }}
                      onDragLeave={() => setDragOverFolderId(null)}
                      title="双击进入 · 拖拽图片归入"
                    >
                      <div className="relative">
                        <FolderOpen size={36} style={{ color: "oklch(0.72 0.16 55)" }} />
                        {count > 0 && (
                          <span
                            className="absolute -bottom-0.5 -right-1 rounded-full px-1"
                            style={{ background: "oklch(0.58 0.22 264)", color: "white", fontSize: "0.55rem", minWidth: "14px", textAlign: "center" }}
                          >
                            {count}
                          </span>
                        )}
                      </div>
                      {renamingId === folder.id ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") confirmRename(); }}
                          onBlur={confirmRename}
                          autoFocus
                          className="w-full text-center bg-transparent outline-none"
                          style={{ color: "oklch(0.85 0.01 260)", fontSize: "0.68rem", borderBottom: "1px solid oklch(0.58 0.22 264 / 0.5)" }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="text-center w-full truncate"
                          style={{ color: "oklch(0.75 0.01 260)", fontSize: "0.68rem" }}
                          onDoubleClick={(e) => { e.stopPropagation(); startRename(folder); }}
                        >
                          {folder.name}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                        className="absolute top-1 right-1 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "oklch(0.62 0.22 25 / 0.85)" }}
                        title="删除文件夹"
                      >
                        <X size={8} style={{ color: "white" }} />
                      </button>
                    </div>
                  );
                }

                const asset = item.asset;
                const usedInSlot = slots.find((s) => s.assetId === asset.id);
                const isUsed = !!usedInSlot;
                const isSelected = selectedIds.has(asset.id);

                return (
                  <div
                    key={asset.id}
                    data-item="asset"
                    data-asset-id={asset.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(asset.id, el);
                      else itemRefs.current.delete(asset.id);
                    }}
                    className="relative group rounded-lg overflow-hidden"
                    style={{
                      aspectRatio: "1",
                      background: "oklch(0.18 0.015 260)",
                      border: isSelected
                        ? "2px solid oklch(0.58 0.22 264)"
                        : isUsed
                        ? "1.5px solid oklch(0.65 0.18 145 / 0.6)"
                        : "1.5px solid oklch(1 0 0 / 0.07)",
                      cursor: "grab",
                      outline: isSelected ? "1px solid oklch(0.58 0.22 264 / 0.5)" : "none",
                      outlineOffset: "1px",
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("assetId", asset.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={(e) => {
                      // 单击切换选中（不影响框选）
                      if (!isDraggingRubber.current) {
                        if (e.ctrlKey || e.metaKey) {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(asset.id)) next.delete(asset.id); else next.add(asset.id);
                            return next;
                          });
                        } else {
                          // 单击不框选时不清空（框选已处理）
                        }
                      }
                    }}
                  >
                    <img
                      src={asset.croppedDataUrl ?? asset.dataUrl}
                      alt={asset.name}
                      className="w-full h-full object-cover pointer-events-none"
                      draggable={false}
                    />

                    {/* 选中高亮覆盖层 */}
                    {isSelected && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: "oklch(0.58 0.22 264 / 0.25)" }}
                      >
                        <div className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: "oklch(0.58 0.22 264)", border: "1.5px solid white" }}>
                          <span style={{ color: "white", fontSize: "9px", lineHeight: 1 }}>✓</span>
                        </div>
                      </div>
                    )}

                    {/* 悬停操作菜单 */}
                    {!isSelected && (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{ background: "oklch(0.10 0.01 260 / 0.85)" }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFillClick(asset.id); }}
                          className="px-2.5 py-1 rounded-md font-medium w-4/5"
                          style={{ background: selectedSlotId ? "oklch(0.58 0.22 264)" : "oklch(0.58 0.22 264 / 0.7)", color: "oklch(0.98 0.005 260)", fontSize: "0.68rem" }}
                        >
                          {selectedSlotId ? "填入选中框" : "选框后填入"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setCropTarget(asset); }}
                          className="px-2.5 py-1 rounded-md font-medium w-4/5 flex items-center justify-center gap-1"
                          style={{ background: asset.cropRect ? "oklch(0.62 0.20 45 / 0.9)" : "oklch(0.62 0.20 45 / 0.7)", color: "oklch(0.98 0.005 260)", fontSize: "0.68rem" }}
                        >
                          <Crop size={10} />
                          {asset.cropRect ? "重新裁剪" : "裁剪图片"}
                        </button>
                        {isUsed && (
                          <button
                            onClick={(e) => { e.stopPropagation(); unfillSlot(usedInSlot!.id); }}
                            className="px-2.5 py-1 rounded-md w-4/5"
                            style={{ background: "oklch(0.62 0.22 25 / 0.85)", color: "oklch(0.98 0 0)", fontSize: "0.68rem" }}
                          >
                            移出图框
                          </button>
                        )}
                        {currentFolderId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromFolder(asset.id); }}
                            className="px-2.5 py-1 rounded-md w-4/5"
                            style={{ background: "oklch(0.22 0.015 260)", color: "oklch(0.60 0.01 260)", fontSize: "0.65rem" }}
                          >
                            移出文件夹
                          </button>
                        )}
                      </div>
                    )}

                    {/* 删除按钮 */}
                    {!isSelected && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "oklch(0.62 0.22 25 / 0.9)" }}
                      >
                        <X size={10} style={{ color: "white" }} />
                      </button>
                    )}

                    {/* 已填标记 */}
                    {isUsed && !isSelected && (
                      <div className="absolute bottom-1 left-1 pointer-events-none">
                        <CheckCircle2 size={13} style={{ color: "oklch(0.65 0.18 145)" }} />
                      </div>
                    )}

                    {/* 图片信息 */}
                    {!isSelected && (
                      <div
                        className="absolute bottom-0 left-0 right-0 px-1.5 py-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "linear-gradient(transparent, oklch(0.10 0.01 260 / 0.9))", color: "oklch(0.85 0.005 260)", fontSize: "0.6rem" }}
                      >
                        <div className="truncate">{asset.name}</div>
                        <div style={{ color: "oklch(0.60 0.01 260)", fontSize: "0.55rem", fontFamily: "monospace" }}>
                          {asset.naturalWidth}×{asset.naturalHeight}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      </div>
    </>
  );
}
