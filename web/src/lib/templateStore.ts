/**
 * 模板库持久化存储
 * 使用 LocalStorage 存储，关闭浏览器/重启电脑后数据仍然存在
 * Key: TEMPLATE_STORE_KEY
 * Value: JSON 序列化的 SavedTemplate[]
 */

import { nanoid } from 'nanoid';
import type { LayoutTemplate, SavedTemplate } from './types';

const TEMPLATE_STORE_KEY = 'photo-layout-studio:template-library';

/** 读取所有已保存的模板（按导入时间倒序） */
export function loadSavedTemplates(): SavedTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTemplate[];
    // 按导入时间倒序（最新的在最前面）
    return parsed.sort((a, b) => b.importedAt - a.importedAt);
  } catch {
    console.warn('[TemplateStore] 读取失败，返回空列表');
    return [];
  }
}

/** 将一个模板保存到本地库（如果同名已存在则覆盖） */
export function saveTemplateToLibrary(
  template: LayoutTemplate,
  thumbnail?: string
): SavedTemplate {
  const existing = loadSavedTemplates();

  // 检查是否有同名模板（同名则更新，不重复添加）
  const existingIndex = existing.findIndex(
    (s) => s.template.name === template.name && s.template.author === template.author
  );

  const entry: SavedTemplate = {
    localId: existingIndex >= 0 ? existing[existingIndex].localId : nanoid(8),
    importedAt: Date.now(),
    template,
    thumbnail,
  };

  if (existingIndex >= 0) {
    existing[existingIndex] = entry;
  } else {
    existing.unshift(entry); // 新模板插入最前面
  }

  persistTemplates(existing);
  return entry;
}

/** 从本地库删除一个模板 */
export function deleteTemplateFromLibrary(localId: string): void {
  const existing = loadSavedTemplates();
  const updated = existing.filter((s) => s.localId !== localId);
  persistTemplates(updated);
}

/** 重命名本地库中的模板 */
export function renameTemplateInLibrary(localId: string, newName: string): void {
  const existing = loadSavedTemplates();
  const idx = existing.findIndex((s) => s.localId === localId);
  if (idx >= 0) {
    existing[idx].template.name = newName;
    persistTemplates(existing);
  }
}

/** 获取本地库中模板数量 */
export function getSavedTemplateCount(): number {
  return loadSavedTemplates().length;
}

/** 生成模板缩略图（离线 Canvas 渲染，仅渲染图框轮廓） */
export function generateTemplateThumbnail(template: LayoutTemplate): string {
  const THUMB_W = 240;
  const THUMB_H = Math.round(THUMB_W * (template.canvas.height / template.canvas.width));
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d')!;

  // 背景
  if (template.canvas.backgroundImage) {
    // 底图模式：绘制底图缩略图
    const img = new Image();
    img.src = template.canvas.backgroundImage;
    // 同步绘制（图片已是 Base64，已在内存中）
    ctx.drawImage(img, 0, 0, THUMB_W, THUMB_H);
  } else {
    ctx.fillStyle = template.canvas.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  }

  // 绘制图框轮廓
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.85)'; // 靛蓝色
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';

  for (const slot of template.slots) {
    const x = (slot.x / 100) * THUMB_W;
    const y = (slot.y / 100) * THUMB_H;
    const w = (slot.w / 100) * THUMB_W;
    const h = (slot.h / 100) * THUMB_H;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  return canvas.toDataURL('image/jpeg', 0.7);
}

/** 内部：将模板列表写入 LocalStorage */
function persistTemplates(templates: SavedTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATE_STORE_KEY, JSON.stringify(templates));
  } catch (e) {
    // LocalStorage 可能已满（底图 Base64 较大）
    console.error('[TemplateStore] 存储失败，可能 LocalStorage 空间不足:', e);
    throw new Error('模板库存储失败：本地存储空间不足，请删除部分旧模板后重试');
  }
}
