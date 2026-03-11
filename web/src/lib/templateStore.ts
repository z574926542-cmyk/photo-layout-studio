/**
 * templateStore.ts — 模板库操作（向后兼容层）
 *
 * 底层存储已迁移到 templateDb.ts（IndexedDB 分层存储）
 * 此文件保留原有 API 签名，内部转发到 templateDb
 */

export {
  loadTemplateIndex as loadSavedTemplates,
  saveTemplate as saveTemplateToLibrary,
  deleteTemplate as deleteTemplateFromLibrary,
  renameTemplate as renameTemplateInLibrary,
  loadTemplateDetail,
  getThumbnail,
  migrateFromLegacyStorage,
} from './templateDb';

export type { TemplateIndex as SavedTemplateIndex } from './templateDb';

/** 获取模板数量（同步，只读索引） */
export function getSavedTemplateCount(): number {
  try {
    const raw = localStorage.getItem('tpl-index-v2');
    if (!raw) return 0;
    return (JSON.parse(raw) as unknown[]).length;
  } catch {
    return 0;
  }
}
