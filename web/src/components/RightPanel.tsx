// ============================================================
// 奇妙奇遇光影集 排版 Studio — 右侧素材库面板
// Design: 专业暗夜工作台 — 访达风格素材管理
// 功能: 照片上传、文件夹管理（访达逻辑）、填入/裁剪/拖拽
//       文件夹与图片混排、双击进入文件夹、面包屑导航、拖拽归类
// ============================================================
import React, { useRef, useCallback, useState } from "react";
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

export default function RightPanel() {
  const {
    state,
    uploadAssets,
    removeAsset,
    removeAssets,
    fillSlot,
    unfillSlot,
    autoFill,
    updateAsset,
  } = useStudio();
  const { assets, slots, selectedSlotId } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [cropTarget, setCropTarget] = useState<Asset | null>(null);

  const [folders, setFolders] = useState<AssetFolder[]>(loadFolders);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

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
      : assets
          .filter((a) => currentFolder?.assetIds.includes(a.id))
          .map((a): ViewItem => ({ type: "asset", asset: a }));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      await uploadAssets(e.target.files);
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
        await uploadAssets(dt.files);
      }
    },
    [uploadAssets]
  );

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    removeAssets(Array.from(selectedIds));
    saveFolders(folders.map((f) => ({ ...f, assetIds: f.assetIds.filter((id) => !selectedIds.has(id)) })));
    setSelectedIds(new Set());
    setSelectMode(false);
    toast.success(`已删除 ${selectedIds.size} 张图片`);
  };

  const filledCount = slots.filter((s) => s.assetId !== null).length;
  const emptyCount = slots.filter((s) => s.assetId === null).length;

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
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: "oklch(0.45 0.01 260)", fontFamily: "monospace", fontSize: "0.7rem" }}>
                {assets.length} 张
              </span>
              <button
                onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
                className="px-1.5 py-0.5 rounded text-xs transition-all"
                style={{
                  background: selectMode ? "oklch(0.58 0.22 264 / 0.2)" : "transparent",
                  color: selectMode ? "oklch(0.72 0.12 264)" : "oklch(0.40 0.01 260)",
                  fontSize: "0.65rem",
                }}
              >
                {selectMode ? "退出" : "多选"}
              </button>
            </div>
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

          {selectedSlotId && (
            <div className="mt-1.5 px-2 py-1 rounded flex items-center gap-1.5"
              style={{ background: "oklch(0.58 0.22 264 / 0.12)", border: "1px solid oklch(0.58 0.22 264 / 0.25)", color: "oklch(0.72 0.12 264)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span style={{ fontSize: "0.7rem" }}>图框已选中 · 点击图片操作</span>
            </div>
          )}

          {selectMode && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span style={{ color: "oklch(0.55 0.01 260)", fontSize: "0.68rem" }}>已选 {selectedIds.size}</span>
              <button onClick={() => setSelectedIds(new Set(assets.map((a) => a.id)))}
                className="px-1.5 py-0.5 rounded"
                style={{ background: "oklch(0.58 0.22 264 / 0.12)", color: "oklch(0.72 0.12 264)", fontSize: "0.65rem" }}>全选</button>
              <button onClick={() => setSelectedIds(new Set())}
                className="px-1.5 py-0.5 rounded"
                style={{ background: "oklch(1 0 0 / 0.06)", color: "oklch(0.50 0.01 260)", fontSize: "0.65rem" }}>清除</button>
              {selectedIds.size > 0 && (
                <button onClick={handleBatchDelete}
                  className="px-1.5 py-0.5 rounded flex items-center gap-1"
                  style={{ background: "oklch(0.55 0.22 25 / 0.2)", color: "oklch(0.75 0.18 25)", fontSize: "0.65rem" }}>
                  <Trash2 size={9} /> 删除
                </button>
              )}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="px-3 py-2 flex gap-2 flex-shrink-0" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs transition-all"
            style={{ background: "oklch(0.58 0.22 264 / 0.15)", border: "1px solid oklch(0.58 0.22 264 / 0.3)", color: "oklch(0.75 0.12 264)", fontFamily: "system-ui" }}>
            <Upload size={12} /> 上传照片
          </button>
          <button onClick={autoFill} disabled={emptyCount === 0 || assets.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs transition-all disabled:opacity-35"
            style={{ background: "oklch(0.62 0.20 45 / 0.15)", border: "1px solid oklch(0.62 0.20 45 / 0.3)", color: "oklch(0.80 0.14 55)", fontFamily: "system-ui" }}>
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
              <span style={{ color: "oklch(0.72 0.01 260)", fontSize: "0.7rem", fontFamily: "system-ui" }} className="truncate">
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

        {/* 内容区（访达风格混排） */}
        <div
          className="flex-1 overflow-y-auto p-2"
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
        >
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
                  return (
                    <div
                      key={folder.id}
                      className="relative group rounded-lg p-2 flex flex-col items-center gap-1 cursor-pointer transition-all"
                      style={{
                        background: isOver ? "oklch(0.65 0.18 145 / 0.12)" : "oklch(0.18 0.015 260)",
                        border: isOver ? "1.5px dashed oklch(0.65 0.18 145 / 0.7)" : "1.5px solid oklch(1 0 0 / 0.07)",
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
                          style={{ color: "oklch(0.75 0.01 260)", fontSize: "0.68rem", fontFamily: "system-ui" }}
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
                    className="relative group rounded-lg overflow-hidden"
                    style={{
                      aspectRatio: "1",
                      background: "oklch(0.18 0.015 260)",
                      border: isSelected
                        ? "2px solid oklch(0.58 0.22 264)"
                        : isUsed
                        ? "1.5px solid oklch(0.65 0.18 145 / 0.6)"
                        : "1.5px solid oklch(1 0 0 / 0.07)",
                      cursor: selectMode ? "pointer" : "grab",
                    }}
                    draggable={!selectMode}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("assetId", asset.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => { if (selectMode) toggleSelect(asset.id); }}
                  >
                    <img
                      src={asset.croppedDataUrl ?? asset.dataUrl}
                      alt={asset.name}
                      className="w-full h-full object-cover pointer-events-none"
                      draggable={false}
                    />

                    {selectMode && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: isSelected ? "oklch(0.58 0.22 264 / 0.35)" : "oklch(0.10 0.01 260 / 0.3)" }}
                      >
                        <div
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                          style={{
                            borderColor: isSelected ? "oklch(0.58 0.22 264)" : "white",
                            background: isSelected ? "oklch(0.58 0.22 264)" : "transparent",
                          }}
                        >
                          {isSelected && <span style={{ color: "white", fontSize: "10px" }}>✓</span>}
                        </div>
                      </div>
                    )}

                    {!selectMode && (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{ background: "oklch(0.10 0.01 260 / 0.85)" }}
                      >
                        <button
                          onClick={() => handleFillClick(asset.id)}
                          className="px-2.5 py-1 rounded-md font-medium w-4/5"
                          style={{ background: selectedSlotId ? "oklch(0.58 0.22 264)" : "oklch(0.58 0.22 264 / 0.7)", color: "oklch(0.98 0.005 260)", fontSize: "0.68rem", fontFamily: "system-ui" }}
                        >
                          {selectedSlotId ? "填入选中框" : "选框后填入"}
                        </button>
                        <button
                          onClick={() => setCropTarget(asset)}
                          className="px-2.5 py-1 rounded-md font-medium w-4/5 flex items-center justify-center gap-1"
                          style={{ background: asset.cropRect ? "oklch(0.62 0.20 45 / 0.9)" : "oklch(0.62 0.20 45 / 0.7)", color: "oklch(0.98 0.005 260)", fontSize: "0.68rem", fontFamily: "system-ui" }}
                        >
                          <Crop size={10} />
                          {asset.cropRect ? "重新裁剪" : "裁剪图片"}
                        </button>
                        {isUsed && (
                          <button
                            onClick={() => unfillSlot(usedInSlot!.id)}
                            className="px-2.5 py-1 rounded-md w-4/5"
                            style={{ background: "oklch(0.62 0.22 25 / 0.85)", color: "oklch(0.98 0 0)", fontSize: "0.68rem", fontFamily: "system-ui" }}
                          >
                            移出图框
                          </button>
                        )}
                        {currentFolderId && (
                          <button
                            onClick={() => removeFromFolder(asset.id)}
                            className="px-2.5 py-1 rounded-md w-4/5"
                            style={{ background: "oklch(0.22 0.015 260)", color: "oklch(0.60 0.01 260)", fontSize: "0.65rem", fontFamily: "system-ui" }}
                          >
                            移出文件夹
                          </button>
                        )}
                      </div>
                    )}

                    {!selectMode && (
                      <button
                        onClick={() => removeAsset(asset.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "oklch(0.62 0.22 25 / 0.9)" }}
                      >
                        <X size={10} style={{ color: "white" }} />
                      </button>
                    )}

                    {isUsed && !selectMode && (
                      <div className="absolute bottom-1 left-1 pointer-events-none">
                        <CheckCircle2 size={13} style={{ color: "oklch(0.65 0.18 145)" }} />
                      </div>
                    )}

                    {!selectMode && (
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
