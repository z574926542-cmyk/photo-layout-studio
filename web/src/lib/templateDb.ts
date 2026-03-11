/**
 * templateDb.ts — IndexedDB 分层存储
 *
 * 架构：
 *   localStorage["tpl-index"]  → TemplateIndex[]（极小，启动时全量读取）
 *   IndexedDB["templates"]     → TemplateDetail（含底图 Base64，按需读取）
 *   IndexedDB["thumbnails"]    → ThumbnailCache（持久化缩略图，按需生成一次）
 *
 * 性能目标：
 *   - 1000 个模板启动耗时 < 100ms（只读索引）
 *   - 滚动始终 60fps（虚拟滚动 + 懒加载缩略图）
 *   - 内存占用恒定（只有可见缩略图在内存）
 */

import type { LayoutTemplate } from './types';

// ─── 类型定义 ──────────────────────────────────────────────

/** 索引层（存 localStorage，极小） */
export interface TemplateIndex {
  id: string;
  name: string;
  author?: string;
  width: number;
  height: number;
  slotCount: number;
  importedAt: number;
}

/** 详情层（存 IndexedDB，含底图 Base64） */
export interface TemplateDetail {
  id: string;
  template: LayoutTemplate;
}

/** 缩略图缓存层（存 IndexedDB，持久化） */
export interface ThumbnailCache {
  id: string;
  dataUrl: string;
  generatedAt: number;
}

// ─── 常量 ─────────────────────────────────────────────────

const DB_NAME = 'photo-layout-studio';
const DB_VERSION = 1;
const STORE_TEMPLATES = 'templates';
const STORE_THUMBNAILS = 'thumbnails';
const INDEX_KEY = 'tpl-index-v2';

// ─── DB 初始化 ─────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_THUMBNAILS)) {
        db.createObjectStore(STORE_THUMBNAILS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbPut(storeName: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

function idbDelete(storeName: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

// ─── 索引层（localStorage） ────────────────────────────────

export function loadTemplateIndex(): TemplateIndex[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as TemplateIndex[]).sort(
      (a, b) => b.importedAt - a.importedAt
    );
  } catch {
    return [];
  }
}

function saveTemplateIndex(index: TemplateIndex[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

// ─── 详情层（IndexedDB） ───────────────────────────────────

export async function loadTemplateDetail(id: string): Promise<LayoutTemplate | undefined> {
  const detail = await idbGet<TemplateDetail>(STORE_TEMPLATES, id);
  return detail?.template;
}

// ─── 缩略图层（IndexedDB） ────────────────────────────────

export async function loadThumbnail(id: string): Promise<string | undefined> {
  const cache = await idbGet<ThumbnailCache>(STORE_THUMBNAILS, id);
  return cache?.dataUrl;
}

async function saveThumbnail(id: string, dataUrl: string): Promise<void> {
  await idbPut(STORE_THUMBNAILS, { id, dataUrl, generatedAt: Date.now() });
}

// ─── 缩略图生成（异步，带持久化缓存） ──────────────────────

function drawSlotOutlines(
  ctx: CanvasRenderingContext2D,
  template: LayoutTemplate,
  w: number,
  h: number
) {
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
  for (const slot of template.slots) {
    const x = (slot.x / 100) * w;
    const y = (slot.y / 100) * h;
    const sw = (slot.w / 100) * w;
    const sh = (slot.h / 100) * h;
    ctx.fillRect(x, y, sw, sh);
    ctx.strokeRect(x, y, sw, sh);
  }
}

/**
 * 获取缩略图（优先从 IndexedDB 缓存读取，缓存不存在则异步生成并持久化）
 * 需要传入 template 用于生成（可从详情层读取）
 */
export async function getThumbnail(
  id: string,
  template: LayoutTemplate
): Promise<string> {
  // 1. 先查 IndexedDB 缓存
  const cached = await loadThumbnail(id);
  if (cached) return cached;

  // 2. 缓存不存在，生成缩略图
  const THUMB_W = 240;
  const THUMB_H = Math.round(THUMB_W * (template.canvas.height / template.canvas.width));
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d')!;

  if (template.canvas.backgroundImage) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, THUMB_W, THUMB_H);
        resolve();
      };
      img.onerror = () => {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, THUMB_W, THUMB_H);
        resolve();
      };
      img.src = template.canvas.backgroundImage!;
    });
  } else {
    ctx.fillStyle = template.canvas.backgroundColor || '#1a1a2e';
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  }

  drawSlotOutlines(ctx, template, THUMB_W, THUMB_H);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

  // 3. 持久化到 IndexedDB（不阻塞返回）
  saveThumbnail(id, dataUrl).catch(console.warn);

  return dataUrl;
}

// ─── 公共 CRUD API ─────────────────────────────────────────

/** 保存模板到库（索引写 localStorage，详情写 IndexedDB，清除旧缩略图缓存） */
export async function saveTemplate(template: LayoutTemplate): Promise<TemplateIndex> {
  const { nanoid } = await import('nanoid');
  const index = loadTemplateIndex();

  const existingIdx = index.findIndex(
    (s) => s.name === template.name && s.author === template.author
  );

  const id = existingIdx >= 0 ? index[existingIdx].id : nanoid(8);
  const entry: TemplateIndex = {
    id,
    name: template.name,
    author: template.author,
    width: template.canvas.width,
    height: template.canvas.height,
    slotCount: template.slots.length,
    importedAt: Date.now(),
  };

  if (existingIdx >= 0) {
    index[existingIdx] = entry;
    // 清除旧缩略图缓存，下次滚到时重新生成
    idbDelete(STORE_THUMBNAILS, id).catch(console.warn);
  } else {
    index.unshift(entry);
  }

  saveTemplateIndex(index);
  await idbPut(STORE_TEMPLATES, { id, template } as TemplateDetail);

  return entry;
}

/** 删除模板（同时清除索引、详情、缩略图） */
export async function deleteTemplate(id: string): Promise<void> {
  const index = loadTemplateIndex().filter((s) => s.id !== id);
  saveTemplateIndex(index);
  await Promise.all([
    idbDelete(STORE_TEMPLATES, id),
    idbDelete(STORE_THUMBNAILS, id),
  ]);
}

/** 重命名模板（只更新索引层） */
export function renameTemplate(id: string, newName: string): void {
  const index = loadTemplateIndex();
  const idx = index.findIndex((s) => s.id === id);
  if (idx >= 0) {
    index[idx].name = newName;
    saveTemplateIndex(index);
  }
}

/** 迁移旧 localStorage 数据到 IndexedDB（一次性，兼容旧版本） */
export async function migrateFromLegacyStorage(): Promise<void> {
  const OLD_KEY = 'photo-layout-studio:template-library';
  const raw = localStorage.getItem(OLD_KEY);
  if (!raw) return;

  try {
    const oldData = JSON.parse(raw) as Array<{
      localId: string;
      importedAt: number;
      template: LayoutTemplate;
    }>;

    for (const item of oldData) {
      await saveTemplate(item.template);
    }

    // 迁移完成后删除旧数据
    localStorage.removeItem(OLD_KEY);
    console.log(`[templateDb] 已迁移 ${oldData.length} 个旧模板到 IndexedDB`);
  } catch (e) {
    console.warn('[templateDb] 迁移旧数据失败:', e);
  }
}
