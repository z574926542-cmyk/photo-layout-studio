// ============================================================
// 奇妙奇遇光影集 排版 Studio — 右侧素材库面板
// Design: 专业暗夜工作台 — 玻璃磨砂面板
// 功能: 照片上传、缩略图网格、填入/裁剪后填入/移除、拖拽支持
// ============================================================
import React, { useRef, useCallback, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { cn } from "@/lib/utils";
import {
  Upload, Trash2, Image, Zap, X, CheckCircle2, Crop,
} from "lucide-react";
import { toast } from "sonner";
import CropModal from "./CropModal";
import type { Asset } from "@/lib/types";

export default function RightPanel() {
  const {
    state,
    uploadAssets,
    removeAsset,
    fillSlot,
    unfillSlot,
    autoFill,
    updateAsset,
  } = useStudio();
  const { assets, slots, selectedSlotId } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // 裁剪弹窗状态（裁剪是素材预处理，不依赖图框选中）
  const [cropTarget, setCropTarget] = useState<Asset | null>(null);

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
        const imageFiles = Array.from(files).filter((f) =>
          f.type.startsWith("image/")
        );
        if (imageFiles.length === 0) {
          toast.error("请上传图片文件（JPG/PNG/WebP 等）");
          return;
        }
        const dt = new DataTransfer();
        imageFiles.forEach((f) => dt.items.add(f));
        await uploadAssets(dt.files);
      }
    },
    [uploadAssets]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // 直接填入
  const handleFillClick = (assetId: string) => {
    if (!selectedSlotId) {
      toast.warning("请先在画布上点选一个图框，再点击填入");
      return;
    }
    fillSlot(selectedSlotId, assetId);
    toast.success("已填入图框");
  };

  // 打开裁剪弹窗（素材预处理，不需要选中图框）
  const handleCropClick = (asset: Asset) => {
    setCropTarget(asset);
  };

  // 裁剪确认：仅更新素材的 croppedDataUrl/cropRect，不自动填入图框
  const handleCropConfirm = useCallback(
    (updatedAsset: Asset) => {
      // 更新素材库中的原始 Asset（保留 id，更新裁剪信息）
      updateAsset(updatedAsset.id, {
        croppedDataUrl: updatedAsset.croppedDataUrl,
        cropRect: updatedAsset.cropRect,
      });
      setCropTarget(null);
      toast.success("裁剪完成！可拖拽或点击填入图框");
    },
    [updateAsset]
  );

  const handleAssetDragStart = (e: React.DragEvent, assetId: string) => {
    e.dataTransfer.setData("assetId", assetId);
    e.dataTransfer.effectAllowed = "copy";
  };

  // 统计
  const filledCount = slots.filter((s) => s.assetId !== null).length;
  const emptyCount = slots.filter((s) => s.assetId === null).length;

  return (
    <>
      {/* 裁剪弹窗（全屏） */}
      {cropTarget && (
        <CropModal
          asset={cropTarget}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropTarget(null)}
        />
      )}

      <div
        className="w-64 flex-shrink-0 flex flex-col h-full"
        style={{
          background: "oklch(0.15 0.016 260 / 0.95)",
          borderLeft: "1px solid oklch(1 0 0 / 0.08)",
        }}
      >
        {/* 标题区 */}
        <div
          className="px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid oklch(1 0 0 / 0.08)" }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{
                fontFamily: "system-ui, sans-serif",
                color: "oklch(0.60 0.015 260)",
                letterSpacing: "0.1em",
              }}
            >
              素材库
            </span>
            <span
              className="text-xs"
              style={{
                color: "oklch(0.45 0.01 260)",
                fontFamily: "monospace",
                fontSize: "0.7rem",
              }}
            >
              {assets.length} 张
            </span>
          </div>

          {/* 图框填充状态 */}
          {slots.length > 0 && (
            <div className="flex gap-3 mt-2">
              <div className="flex items-center gap-1">
                <CheckCircle2 size={10} style={{ color: "oklch(0.65 0.18 145)" }} />
                <span
                  className="text-xs"
                  style={{
                    color: "oklch(0.65 0.18 145)",
                    fontFamily: "monospace",
                    fontSize: "0.7rem",
                  }}
                >
                  {filledCount} 已填
                </span>
              </div>
              {emptyCount > 0 && (
                <div className="flex items-center gap-1">
                  <div
                    className="w-2.5 h-2.5 rounded-sm border"
                    style={{ borderColor: "oklch(0.58 0.22 264 / 0.5)" }}
                  />
                  <span
                    className="text-xs"
                    style={{
                      color: "oklch(0.50 0.01 260)",
                      fontFamily: "monospace",
                      fontSize: "0.7rem",
                    }}
                  >
                    {emptyCount} 空置
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 选中图框提示 */}
          {selectedSlotId && (
            <div
              className="mt-2 px-2 py-1 rounded text-xs flex items-center gap-1.5"
              style={{
                background: "oklch(0.58 0.22 264 / 0.12)",
                border: "1px solid oklch(0.58 0.22 264 / 0.25)",
                color: "oklch(0.72 0.12 264)",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span style={{ fontSize: "0.7rem" }}>图框已选中 · 点击图片操作</span>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div
          className="px-3 py-2 flex gap-2 flex-shrink-0"
          style={{ borderBottom: "1px solid oklch(1 0 0 / 0.06)" }}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs transition-all"
            style={{
              background: "oklch(0.58 0.22 264 / 0.15)",
              border: "1px solid oklch(0.58 0.22 264 / 0.3)",
              color: "oklch(0.75 0.12 264)",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <Upload size={12} />
            上传照片
          </button>
          <button
            onClick={autoFill}
            disabled={emptyCount === 0 || assets.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs transition-all disabled:opacity-35"
            style={{
              background: "oklch(0.72 0.16 55 / 0.15)",
              border: "1px solid oklch(0.72 0.16 55 / 0.3)",
              color: "oklch(0.80 0.12 55)",
              fontFamily: "system-ui, sans-serif",
            }}
            title="智能比例匹配，自动填充所有空图框"
          >
            <Zap size={12} />
            自动填充
          </button>
        </div>

        {/* 素材网格 / 拖放区 */}
        <div
          className="flex-1 overflow-y-auto p-3"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {assets.length === 0 ? (
            <div
              className="h-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed min-h-40 transition-all"
              style={{
                borderColor: isDragOver
                  ? "oklch(0.58 0.22 264 / 0.6)"
                  : "oklch(0.58 0.22 264 / 0.2)",
                background: isDragOver
                  ? "oklch(0.58 0.22 264 / 0.06)"
                  : "transparent",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.20 0.015 260)" }}
              >
                <Image size={20} style={{ color: "oklch(0.40 0.01 260)" }} />
              </div>
              <div className="text-center px-4">
                <div className="text-xs font-medium mb-1" style={{ color: "oklch(0.55 0.01 260)" }}>
                  拖拽图片到此处
                </div>
                <div className="text-xs" style={{ color: "oklch(0.38 0.01 260)" }}>
                  或点击上方"上传照片"按钮
                </div>
                <div className="text-xs mt-1" style={{ color: "oklch(0.32 0.01 260)" }}>
                  支持 JPG / PNG / WebP
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 拖放提示条 */}
              {isDragOver && (
                <div
                  className="mb-2 px-3 py-2 rounded-lg text-xs text-center"
                  style={{
                    background: "oklch(0.58 0.22 264 / 0.15)",
                    border: "1px solid oklch(0.58 0.22 264 / 0.4)",
                    color: "oklch(0.75 0.12 264)",
                  }}
                >
                  松开鼠标添加到素材库
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {assets.map((asset) => {
                  const usedInSlot = slots.find((s) => s.assetId === asset.id);
                  const isUsed = !!usedInSlot;
                  const isInSelectedSlot = usedInSlot?.id === selectedSlotId;

                  return (
                    <div
                      key={asset.id}
                      className="relative group rounded-lg overflow-hidden"
                      style={{
                        aspectRatio: "1",
                        background: "oklch(0.20 0.015 260)",
                        border: isInSelectedSlot
                          ? "2px solid oklch(0.58 0.22 264)"
                          : isUsed
                          ? "1.5px solid oklch(0.65 0.18 145 / 0.5)"
                          : "1px solid oklch(1 0 0 / 0.08)",
                        cursor: "grab",
                        transition: "border-color 0.15s ease",
                      }}
                      draggable
                      onDragStart={(e) => handleAssetDragStart(e, asset.id)}
                    >
                      {/* 素材缩略图：有裁剪则显示裁剪结果 */}
                      <img
                        src={asset.croppedDataUrl ?? asset.dataUrl}
                        alt={asset.name}
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                      {/* 裁剪状态标记 */}
                      {asset.cropRect && (
                        <div
                          className="absolute top-1 left-1 px-1 py-0.5 rounded pointer-events-none"
                          style={{
                            background: "oklch(0.62 0.20 45 / 0.85)",
                            fontSize: "0.55rem",
                            color: "white",
                            fontFamily: "monospace",
                            lineHeight: 1,
                          }}
                        >
                          已裁剪
                        </div>
                      )}

                      {/* 悬停操作层 */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{ background: "oklch(0.10 0.01 260 / 0.85)" }}
                      >
                        {/* 填入按钮 */}
                        <button
                          onClick={() => handleFillClick(asset.id)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium transition-all w-[80%]"
                          style={{
                            background: selectedSlotId
                              ? "oklch(0.58 0.22 264)"
                              : "oklch(0.58 0.22 264 / 0.7)",
                            color: "oklch(0.98 0.005 260)",
                            fontSize: "0.68rem",
                            fontFamily: "system-ui, sans-serif",
                          }}
                        >
                          {selectedSlotId ? "填入选中框" : "选框后填入"}
                        </button>

                        {/* 裁剪按钮（素材预处理，不需要选中图框） */}
                        <button
                          onClick={() => handleCropClick(asset)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium transition-all w-[80%] flex items-center justify-center gap-1"
                          style={{
                            background: asset.cropRect
                              ? "oklch(0.62 0.20 45 / 0.9)"
                              : "oklch(0.62 0.20 45 / 0.7)",
                            color: "oklch(0.98 0.005 260)",
                            fontSize: "0.68rem",
                            fontFamily: "system-ui, sans-serif",
                          }}
                        >
                          <Crop size={10} />
                          {asset.cropRect ? "重新裁剪" : "裁剪图片"}
                        </button>

                        {/* 移出图框 */}
                        {isUsed && (
                          <button
                            onClick={() => unfillSlot(usedInSlot!.id)}
                            className="px-2.5 py-1 rounded-md text-xs transition-all w-[80%]"
                            style={{
                              background: "oklch(0.62 0.22 25 / 0.85)",
                              color: "oklch(0.98 0 0)",
                              fontSize: "0.68rem",
                              fontFamily: "system-ui, sans-serif",
                            }}
                          >
                            移出图框
                          </button>
                        )}
                      </div>

                      {/* 删除按钮 */}
                      <button
                        onClick={() => removeAsset(asset.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "oklch(0.62 0.22 25 / 0.9)" }}
                      >
                        <X size={10} style={{ color: "white" }} />
                      </button>

                      {/* 已使用标记 */}
                      {isUsed && (
                        <div className="absolute bottom-1 left-1 pointer-events-none">
                          <CheckCircle2
                            size={13}
                            style={{ color: "oklch(0.65 0.18 145)" }}
                          />
                        </div>
                      )}

                      {/* 图片名称（底部渐变） */}
                      <div
                        className="absolute bottom-0 left-0 right-0 px-1.5 py-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: "linear-gradient(transparent, oklch(0.10 0.01 260 / 0.9))",
                          color: "oklch(0.85 0.005 260)",
                          fontSize: "0.6rem",
                        }}
                      >
                        <div className="truncate">{asset.name}</div>
                        <div
                          style={{ color: "oklch(0.60 0.01 260)", fontSize: "0.55rem", fontFamily: "monospace" }}
                        >
                          {asset.naturalWidth}×{asset.naturalHeight}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </>
  );
}
