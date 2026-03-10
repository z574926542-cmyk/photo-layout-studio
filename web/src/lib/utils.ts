import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";
import type { Asset, Slot, PresetTemplate, LayoutTemplate } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 生成唯一 ID */
export const genId = () => nanoid(8);

/** 将画布坐标转换为百分比坐标 */
export function toPct(value: number, total: number): number {
  return Math.max(0, Math.min(100, (value / total) * 100));
}

/** 将百分比坐标转换为画布坐标 */
export function fromPct(pct: number, total: number): number {
  return (pct / 100) * total;
}

/** 限制数值范围 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 四舍五入到指定小数位 */
export function round(value: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** 计算图片宽高比 */
export function calcAspectRatio(w: number, h: number): number {
  return h === 0 ? 1 : w / h;
}

/** 智能自动排版算法：比例匹配 */
export function smartAutoFill(
  slots: Slot[],
  assets: Asset[]
): Map<string, string> {
  const result = new Map<string, string>();
  const emptySlots = slots.filter((s) => s.assetId === null);
  if (emptySlots.length === 0 || assets.length === 0) return result;

  const usedAssetIds = new Set(slots.map((s) => s.assetId).filter(Boolean));
  const availableAssets = assets.filter((a) => !usedAssetIds.has(a.id));
  if (availableAssets.length === 0) return result;

  const assignedAssets = new Set<string>();

  for (const slot of emptySlots) {
    const slotAR = slot.w / slot.h;
    let bestAsset: Asset | null = null;
    let bestDiff = Infinity;

    for (const asset of availableAssets) {
      if (assignedAssets.has(asset.id)) continue;
      const diff = Math.abs(asset.aspectRatio - slotAR);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestAsset = asset;
      }
    }

    if (bestAsset) {
      result.set(slot.id, bestAsset.id);
      assignedAssets.add(bestAsset.id);
    }
  }

  return result;
}

/** 从图片文件读取 Base64 和尺寸 */
export function readImageFile(file: File): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          id: genId(),
          name: file.name,
          dataUrl,
          croppedDataUrl: null,
          cropRect: null,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          aspectRatio: calcAspectRatio(img.naturalWidth, img.naturalHeight),
        });
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 从图片文件读取画布背景（底图模式） */
export function readBackgroundFile(file: File): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 获取 Asset 实际用于显示/导出的 dataUrl
 * 如果有裁剪版本则用裁剪版本，否则用原图
 */
export function getAssetDisplayUrl(asset: Asset): string {
  return asset.croppedDataUrl ?? asset.dataUrl;
}

/**
 * 获取 Asset 实际用于显示/导出的尺寸
 * 如果有裁剪版本则用裁剪尺寸，否则用原图尺寸
 */
export function getAssetDisplaySize(asset: Asset): { width: number; height: number } {
  if (asset.cropRect) {
    return { width: asset.cropRect.width, height: asset.cropRect.height };
  }
  return { width: asset.naturalWidth, height: asset.naturalHeight };
}

/** 高清导出画布为 PNG（contain 模式：图片完整显示，不裁剪内容）
 * 返回 dataUrl 字符串，由调用方决定如何保存（Electron 写文件 / 浏览器下载）
 */
export async function exportCanvasToPng(
  canvasWidth: number,
  canvasHeight: number,
  backgroundImage: string | null,
  backgroundColor: string,
  slots: Slot[],
  assets: Asset[]
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d")!;

  if (backgroundImage) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        resolve();
      };
      img.src = backgroundImage;
    });
  } else {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  for (const slot of slots) {
    if (!slot.assetId) continue;
    const asset = assets.find((a) => a.id === slot.assetId);
    if (!asset) continue;

    const slotX = (slot.x / 100) * canvasWidth;
    const slotY = (slot.y / 100) * canvasHeight;
    const slotW = (slot.w / 100) * canvasWidth;
    const slotH = (slot.h / 100) * canvasHeight;

    // 使用裁剪后的图片（如有），否则用原图
    const displayUrl = getAssetDisplayUrl(asset);
    const displaySize = getAssetDisplaySize(asset);

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(slotX, slotY, slotW, slotH);
        ctx.clip();

        // contain 模式：图片完整显示在图框内，保持比例，居中
        const imgAR = displaySize.width / displaySize.height;
        const slotAR = slotW / slotH;
        let drawW: number, drawH: number;
        if (imgAR > slotAR) {
          // 图片更宽：以宽度为基准，高度缩小
          drawW = slotW;
          drawH = slotW / imgAR;
        } else {
          // 图片更高：以高度为基准，宽度缩小
          drawH = slotH;
          drawW = slotH * imgAR;
        }

        // 居中放置
        const drawX = slotX + (slotW - drawW) / 2;
        const drawY = slotY + (slotH - drawH) / 2;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
        resolve();
      };
      img.src = displayUrl;
    });
  }

  // 返回 dataUrl，由调用方决定如何保存
  return canvas.toDataURL("image/png", 1.0);
}

/** 预设模板 */
export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: "grid-2x2",
    name: "2×2 网格",
    description: "四张等分照片",
    canvas: { width: 1200, height: 1200 },
    slots: [
      { x: 1, y: 1, w: 48.5, h: 48.5, label: "1" },
      { x: 50.5, y: 1, w: 48.5, h: 48.5, label: "2" },
      { x: 1, y: 50.5, w: 48.5, h: 48.5, label: "3" },
      { x: 50.5, y: 50.5, w: 48.5, h: 48.5, label: "4" },
    ],
  },
  {
    id: "hero-2",
    name: "主图+双图",
    description: "左大右双竖排",
    canvas: { width: 1200, height: 800 },
    slots: [
      { x: 1, y: 1, w: 65, h: 98, label: "主图" },
      { x: 67, y: 1, w: 32, h: 48, label: "副图1" },
      { x: 67, y: 51, w: 32, h: 48, label: "副图2" },
    ],
  },
  {
    id: "triptych",
    name: "三联横排",
    description: "三张等宽横排",
    canvas: { width: 1800, height: 600 },
    slots: [
      { x: 1, y: 1, w: 31.5, h: 98, label: "1" },
      { x: 34, y: 1, w: 31.5, h: 98, label: "2" },
      { x: 67, y: 1, w: 32, h: 98, label: "3" },
    ],
  },
  {
    id: "magazine",
    name: "杂志版式",
    description: "大图+多小图",
    canvas: { width: 1200, height: 900 },
    slots: [
      { x: 1, y: 1, w: 65, h: 65, label: "封面" },
      { x: 67, y: 1, w: 32, h: 31, label: "副图1" },
      { x: 67, y: 34, w: 32, h: 31, label: "副图2" },
      { x: 1, y: 68, w: 32, h: 31, label: "副图3" },
      { x: 34.5, y: 68, w: 32, h: 31, label: "副图4" },
      { x: 67, y: 68, w: 32, h: 31, label: "副图5" },
    ],
  },
  {
    id: "a4-portrait",
    name: "A4 竖版",
    description: "A4 尺寸竖向排版",
    canvas: { width: 2480, height: 3508 },
    slots: [
      { x: 5, y: 5, w: 90, h: 40, label: "顶部大图" },
      { x: 5, y: 47, w: 43, h: 25, label: "左图" },
      { x: 52, y: 47, w: 43, h: 25, label: "右图" },
      { x: 5, y: 74, w: 90, h: 21, label: "底部横图" },
    ],
  },
];

/** 创建新图框 */
export function createSlot(
  x: number, y: number, w: number, h: number,
  label?: string
): Slot {
  return {
    id: genId(),
    x: round(x, 2),
    y: round(y, 2),
    w: round(Math.max(w, 2), 2),
    h: round(Math.max(h, 2), 2),
    assetId: null,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    label,
  };
}

/** 格式化数字显示 */
export function fmt(n: number, decimals: number = 1): string {
  return n.toFixed(decimals);
}

/**
 * 将当前画布和图框打包为模板文件并下载
 * 底图以 Base64 内嵌在 JSON 中，图框仅保存布局信息（不保存已填充的照片）
 */
export function exportTemplate(
  canvasWidth: number,
  canvasHeight: number,
  backgroundColor: string,
  backgroundImage: string | null,
  slots: Slot[],
  templateName: string,
  author?: string,
  description?: string
): void {
  const template: LayoutTemplate = {
    _type: 'photo-layout-template',
    version: 1,
    name: templateName,
    author,
    description,
    createdAt: Date.now(),
    canvas: {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor,
      ...(backgroundImage ? { backgroundImage } : {}),
    },
    slots: slots.map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      w: s.w,
      h: s.h,
      ...(s.label ? { label: s.label } : {}),
    })),
  };

  const json = JSON.stringify(template, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = templateName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '-');
  a.download = `模板-${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入模板
 * 返回解析后的 LayoutTemplate，如果格式错误则 throw
 */
export function parseTemplateFile(jsonText: string): LayoutTemplate {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('文件不是有效的 JSON 格式');
  }

  const t = data as Record<string, unknown>;
  if (t._type !== 'photo-layout-template') {
    throw new Error('不是有效的排版模板文件（缺少 _type 字段）');
  }
  if (!t.canvas || !Array.isArray(t.slots)) {
    throw new Error('模板文件缺少必要字段（canvas / slots）');
  }

  return data as LayoutTemplate;
}

/**
 * 将 LayoutTemplate 中的图框转换为 Slot 列表
 */
export function templateSlotsToSlots(templateSlots: LayoutTemplate['slots']): Slot[] {
  return templateSlots.map((ts) => {
    // 兼容两种格式：w/h（标准格式）和 width/height（旧格式/手动构造）
    const raw = ts as Record<string, unknown>;
    const w = typeof raw.w === 'number' ? raw.w
      : typeof raw.width === 'number' ? (raw.width as number) / 12  // px 转百分比
      : 20;
    const h = typeof raw.h === 'number' ? raw.h
      : typeof raw.height === 'number' ? (raw.height as number) / 9  // px 转百分比
      : 20;
    return {
      id: genId(), // 重新生成 ID 避免冲突
      x: typeof raw.x === 'number' ? raw.x : 0,
      y: typeof raw.y === 'number' ? raw.y : 0,
      w: Math.max(w, 1),
      h: Math.max(h, 1),
      assetId: null,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      label: typeof raw.label === 'string' ? raw.label : undefined,
    };
  });
}
