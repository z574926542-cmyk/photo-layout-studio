// ============================================================
// 奇妙奇遇光影集 排版 Studio — 全局状态管理
// Design: 专业暗夜工作台
// ============================================================
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type {
  Asset,
  Slot,
  CanvasConfig,
  LayoutScheme,
  EditorMode,
  LayoutTemplate,
} from "@/lib/types";
import type { TemplateIndex } from "@/lib/templateDb";
import {
  loadTemplateIndex,
  saveTemplate as saveTemplateToDb,
  deleteTemplate as deleteFromDb,
  renameTemplate as renameInDb,
  loadTemplateDetail,
  migrateFromLegacyStorage,
} from "@/lib/templateDb";
import {
  genId,
  smartAutoFill,
  readImageFile,
  readBackgroundFile,
  exportCanvasToPng,
  exportTemplate,
  parseTemplateFile,
  templateSlotsToSlots,
  PRESET_TEMPLATES,
  createSlot,
  round,
  clamp,
} from "@/lib/utils";
import { toast } from "sonner";
import { exportPng as electronExportPng, isElectron } from "@/lib/electronBridge";

// ─── State ────────────────────────────────────────────────
interface StudioState {
  canvas: CanvasConfig;
  slots: Slot[];
  assets: Asset[];
  selectedSlotId: string | null;
  selectedSlotIds: string[]; // 多选图框 ID 列表
  mode: EditorMode;
  zoom: number; // 0.2 ~ 4.0
  schemes: LayoutScheme[];
  activeSchemeId: string | null;
  aspectLocked: boolean;
  isExporting: boolean;
  history: { slots: Slot[]; canvas: CanvasConfig }[];
  historyIndex: number;
}

// ─── Actions ──────────────────────────────────────────────
type Action =
  | { type: "SET_MODE"; mode: EditorMode }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_CANVAS"; canvas: Partial<CanvasConfig> }
  | { type: "SET_SLOTS"; slots: Slot[] }
  | { type: "ADD_SLOT"; slot: Slot }
  | { type: "UPDATE_SLOT"; id: string; updates: Partial<Slot> }
  | { type: "DELETE_SLOT"; id: string }
  | { type: "CLEAR_SLOTS" }
  | { type: "SELECT_SLOT"; id: string | null }
  | { type: "ADD_ASSETS"; assets: Asset[] }
  | { type: "UPDATE_ASSET"; id: string; updates: Partial<Asset> }
  | { type: "REMOVE_ASSET"; id: string }
  | { type: "REMOVE_ASSETS"; ids: string[] }
  | { type: "FILL_SLOT"; slotId: string; assetId: string }
  | { type: "UNFILL_SLOT"; slotId: string }
  | { type: "AUTO_FILL" }
  | { type: "CLEAR_ALL_FILLS" }
  | { type: "AUTO_FILL_ORDERED"; assetIds: string[] }
  | { type: "LOAD_SCHEME"; scheme: LayoutScheme }
  | { type: "SAVE_SCHEME"; name: string }
  | { type: "DELETE_SCHEME"; id: string }
  | { type: "RENAME_SCHEME"; id: string; name: string }
  | { type: "SET_ASPECT_LOCKED"; locked: boolean }
  | { type: "SET_EXPORTING"; value: boolean }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "PUSH_HISTORY" }
  | { type: "LOAD_PRESET"; presetId: string }
  | { type: "NEW_CANVAS"; width: number; height: number }
  | { type: "SET_BG_IMAGE"; dataUrl: string; width: number; height: number }
  | { type: "CLEAR_BG_IMAGE" }
  | { type: "REORDER_SLOT"; id: string; direction: "up" | "down" | "top" | "bottom" }
  | { type: "DUPLICATE_SLOT"; id: string }
  | { type: "ALIGN_SLOTS"; ids: string[]; align: "left" | "centerH" | "right" | "top" | "centerV" | "bottom" | "distributeH" | "distributeV"; relativeTo: "selection" | "canvas" }
  | { type: "SELECT_SLOTS"; ids: string[] };

// ─── Initial State ────────────────────────────────────────
const DEFAULT_CANVAS: CanvasConfig = {
  width: 1200,
  height: 900,
  backgroundImage: null,
  backgroundColor: "#ffffff",
};

const STORAGE_KEY = "studio_schemes_v1";

function loadSchemes(): LayoutScheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveSchemes(schemes: LayoutScheme[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
  } catch {}
}

function calcInitialZoom(): number {
  if (typeof window === 'undefined') return 0.75;
  // 左侧面板 288px + 右侧面板 256px + padding 128px
  const availableW = window.innerWidth - 288 - 256 - 128;
  const availableH = window.innerHeight - 48 - 28 - 64; // toolbar + bottombar + padding
  const fitW = availableW / DEFAULT_CANVAS.width;
  const fitH = availableH / DEFAULT_CANVAS.height;
  return Math.min(fitW, fitH, 1);
}

const initialState: StudioState = {
  canvas: DEFAULT_CANVAS,
  slots: [],
  assets: [],
  selectedSlotId: null,
  selectedSlotIds: [],
  mode: "select",
  zoom: calcInitialZoom(),
  schemes: loadSchemes(),
  activeSchemeId: null,
  aspectLocked: false,
  isExporting: false,
  history: [{ slots: [], canvas: DEFAULT_CANVAS }],
  historyIndex: 0,
};

// ─── Reducer ──────────────────────────────────────────────
function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode };

    case "SET_ZOOM":
      return { ...state, zoom: clamp(action.zoom, 0.2, 4.0) };

    case "SET_CANVAS": {
      const newCanvas = { ...state.canvas, ...action.canvas };
      return { ...state, canvas: newCanvas };
    }

    case "SET_SLOTS":
      return { ...state, slots: action.slots };

    case "ADD_SLOT": {
      const newSlots = [...state.slots, action.slot];
      return pushHistory({ ...state, slots: newSlots });
    }

    case "UPDATE_SLOT": {
      const newSlots = state.slots.map((s) =>
        s.id === action.id ? { ...s, ...action.updates } : s
      );
      return { ...state, slots: newSlots };
    }

    case "DELETE_SLOT": {
      const newSlots = state.slots.filter((s) => s.id !== action.id);
      const newSelected =
        state.selectedSlotId === action.id ? null : state.selectedSlotId;
      return pushHistory({
        ...state,
        slots: newSlots,
        selectedSlotId: newSelected,
      });
    }

    case "CLEAR_SLOTS":
      return pushHistory({
        ...state,
        slots: [],
        selectedSlotId: null,
      });

    case "SELECT_SLOT":
      return { ...state, selectedSlotId: action.id };

    case "ADD_ASSETS":
      return { ...state, assets: [...state.assets, ...action.assets] };

    case "UPDATE_ASSET": {
      const newAssets = state.assets.map((a) =>
        a.id === action.id ? { ...a, ...action.updates } : a
      );
      return { ...state, assets: newAssets };
    }

    case "REMOVE_ASSET": {
      const newAssets = state.assets.filter((a) => a.id !== action.id);
      const newSlots = state.slots.map((s) =>
        s.assetId === action.id ? { ...s, assetId: null } : s
      );
      return { ...state, assets: newAssets, slots: newSlots };
    }

    case "REMOVE_ASSETS": {
      const idSet = new Set(action.ids);
      const newAssets = state.assets.filter((a) => !idSet.has(a.id));
      const newSlots = state.slots.map((s) =>
        s.assetId && idSet.has(s.assetId) ? { ...s, assetId: null } : s
      );
      return { ...state, assets: newAssets, slots: newSlots };
    }

    case "FILL_SLOT": {
      const newSlots = state.slots.map((s) =>
        s.id === action.slotId
          ? { ...s, assetId: action.assetId, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 }
          : s
      );
      return pushHistory({ ...state, slots: newSlots });
    }

    case "UNFILL_SLOT": {
      const newSlots = state.slots.map((s) =>
        s.id === action.slotId ? { ...s, assetId: null } : s
      );
      return pushHistory({ ...state, slots: newSlots });
    }

    case "AUTO_FILL": {
      const fillMap = smartAutoFill(state.slots, state.assets);
      if (fillMap.size === 0) return state;
      const newSlots = state.slots.map((s) => {
        const assetId = fillMap.get(s.id);
        return assetId ? { ...s, assetId, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 } : s;
      });
      return pushHistory({ ...state, slots: newSlots });
    }

    case "CLEAR_ALL_FILLS": {
      if (state.slots.every((s) => !s.assetId)) return state;
      const newSlots = state.slots.map((s) => ({ ...s, assetId: null, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 }));
      return pushHistory({ ...state, slots: newSlots, selectedSlotId: null });
    }

    case "AUTO_FILL_ORDERED": {
      const emptySlots = state.slots.filter((s) => !s.assetId);
      if (emptySlots.length === 0 || action.assetIds.length === 0) return state;
      const emptySlotIds = emptySlots.map((s) => s.id);
      const newSlots = state.slots.map((s) => {
        const idx = emptySlotIds.indexOf(s.id);
        if (idx === -1) return s;
        const assetId = action.assetIds[idx];
        return assetId ? { ...s, assetId, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 } : s;
      });
      return pushHistory({ ...state, slots: newSlots });
    }

    case "LOAD_SCHEME": {
      return {
        ...state,
        canvas: action.scheme.canvas,
        slots: action.scheme.slots,
        selectedSlotId: null,
        activeSchemeId: action.scheme.id,
        history: [{ slots: action.scheme.slots, canvas: action.scheme.canvas }],
        historyIndex: 0,
      };
    }

    case "SAVE_SCHEME": {
      const existing = state.activeSchemeId
        ? state.schemes.find((s) => s.id === state.activeSchemeId)
        : null;
      const now = Date.now();

      if (existing) {
        const updated: LayoutScheme = {
          ...existing,
          name: action.name,
          canvas: state.canvas,
          slots: state.slots,
          updatedAt: now,
        };
        const newSchemes = state.schemes.map((s) =>
          s.id === existing.id ? updated : s
        );
        saveSchemes(newSchemes);
        return {
          ...state,
          schemes: newSchemes,
          activeSchemeId: existing.id,
        };
      } else {
        const newScheme: LayoutScheme = {
          id: genId(),
          name: action.name,
          canvas: state.canvas,
          slots: state.slots,
          createdAt: now,
          updatedAt: now,
        };
        const newSchemes = [newScheme, ...state.schemes];
        saveSchemes(newSchemes);
        return {
          ...state,
          schemes: newSchemes,
          activeSchemeId: newScheme.id,
        };
      }
    }

    case "DELETE_SCHEME": {
      const newSchemes = state.schemes.filter((s) => s.id !== action.id);
      saveSchemes(newSchemes);
      return {
        ...state,
        schemes: newSchemes,
        activeSchemeId:
          state.activeSchemeId === action.id ? null : state.activeSchemeId,
      };
    }

    case "RENAME_SCHEME": {
      const newSchemes = state.schemes.map((s) =>
        s.id === action.id ? { ...s, name: action.name } : s
      );
      saveSchemes(newSchemes);
      return { ...state, schemes: newSchemes };
    }

    case "SET_ASPECT_LOCKED":
      return { ...state, aspectLocked: action.locked };

    case "SET_EXPORTING":
      return { ...state, isExporting: action.value };

    case "UNDO": {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const entry = state.history[newIndex];
      return {
        ...state,
        slots: entry.slots,
        canvas: entry.canvas,
        historyIndex: newIndex,
        selectedSlotId: null,
      };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const entry = state.history[newIndex];
      return {
        ...state,
        slots: entry.slots,
        canvas: entry.canvas,
        historyIndex: newIndex,
        selectedSlotId: null,
      };
    }

    case "PUSH_HISTORY":
      return pushHistory(state);

    case "LOAD_PRESET": {
      const preset = PRESET_TEMPLATES.find((p) => p.id === action.presetId);
      if (!preset) return state;
      const newSlots = preset.slots.map((s) =>
        createSlot(s.x, s.y, s.w, s.h, s.label)
      );
      const newCanvas: CanvasConfig = {
        ...DEFAULT_CANVAS,
        width: preset.canvas.width,
        height: preset.canvas.height,
      };
      const availableW = (typeof window !== 'undefined' ? window.innerWidth : 1280) - 288 - 256 - 128;
      const availableH = (typeof window !== 'undefined' ? window.innerHeight : 768) - 48 - 28 - 64;
      const fitZoom = Math.min(availableW / newCanvas.width, availableH / newCanvas.height, 1);
      return {
        ...state,
        canvas: newCanvas,
        slots: newSlots,
        selectedSlotId: null,
        activeSchemeId: null,
        zoom: fitZoom,
        history: [{ slots: newSlots, canvas: newCanvas }],
        historyIndex: 0,
      };
    }

    case "NEW_CANVAS": {
      const newCanvas: CanvasConfig = {
        width: action.width,
        height: action.height,
        backgroundImage: null,
        backgroundColor: "#ffffff",
      };
      const availW = (typeof window !== 'undefined' ? window.innerWidth : 1280) - 288 - 256 - 128;
      const availH = (typeof window !== 'undefined' ? window.innerHeight : 768) - 48 - 28 - 64;
      const fitZ = Math.min(availW / action.width, availH / action.height, 1);
      return {
        ...state,
        canvas: newCanvas,
        slots: [],
        selectedSlotId: null,
        activeSchemeId: null,
        zoom: fitZ,
        history: [{ slots: [], canvas: newCanvas }],
        historyIndex: 0,
      };
    }

    case "SET_BG_IMAGE": {
      const newCanvas: CanvasConfig = {
        ...state.canvas,
        width: action.width,
        height: action.height,
        backgroundImage: action.dataUrl,
      };
      return {
        ...state,
        canvas: newCanvas,
        history: [{ slots: state.slots, canvas: newCanvas }],
        historyIndex: 0,
      };
    }

     case "CLEAR_BG_IMAGE": {
      const newCanvas = { ...state.canvas, backgroundImage: null };
      return { ...state, canvas: newCanvas };
    }
    // ─── 图层顺序调整 ───────────────────────────────────────────────
    case "REORDER_SLOT": {
      const idx = state.slots.findIndex((s) => s.id === action.id);
      if (idx === -1) return state;
      const slots = [...state.slots];
      if (action.direction === "up" && idx < slots.length - 1) {
        [slots[idx], slots[idx + 1]] = [slots[idx + 1], slots[idx]];
      } else if (action.direction === "down" && idx > 0) {
        [slots[idx], slots[idx - 1]] = [slots[idx - 1], slots[idx]];
      } else if (action.direction === "top") {
        const [item] = slots.splice(idx, 1);
        slots.push(item);
      } else if (action.direction === "bottom") {
        const [item] = slots.splice(idx, 1);
        slots.unshift(item);
      }
      return pushHistory({ ...state, slots });
    }
    // ─── 复制图框 ─────────────────────────────────────────────────────
    case "DUPLICATE_SLOT": {
      const src = state.slots.find((s) => s.id === action.id);
      if (!src) return state;
      const newSlot: Slot = {
        ...src,
        id: genId(),
        assetId: null, // 复制图框不复制图片
        x: Math.min(src.x + 2, 100 - src.w),
        y: Math.min(src.y + 2, 100 - src.h),
      };
      return pushHistory({ ...state, slots: [...state.slots, newSlot], selectedSlotId: newSlot.id });
    }
    // ─── 对齐工具 ─────────────────────────────────────────────────────
    case "ALIGN_SLOTS": {
      const targets = state.slots.filter((s) => action.ids.includes(s.id));
      if (targets.length < 1) return state;
      const canvas = state.canvas;
      // 计算选中图框的边界盒
      const minX = Math.min(...targets.map((s) => s.x));
      const maxX = Math.max(...targets.map((s) => s.x + s.w));
      const minY = Math.min(...targets.map((s) => s.y));
      const maxY = Math.max(...targets.map((s) => s.y + s.h));
      const selW = maxX - minX;
      const selH = maxY - minY;
      // 参考尺寸：相对于选中区域或画布
      const refLeft = action.relativeTo === "canvas" ? 0 : minX;
      const refRight = action.relativeTo === "canvas" ? 100 : maxX;
      const refTop = action.relativeTo === "canvas" ? 0 : minY;
      const refBottom = action.relativeTo === "canvas" ? 100 : maxY;
      const refW = refRight - refLeft;
      const refH = refBottom - refTop;
      const updatedSlots = state.slots.map((s) => {
        if (!action.ids.includes(s.id)) return s;
        switch (action.align) {
          case "left": return { ...s, x: refLeft };
          case "right": return { ...s, x: refRight - s.w };
          case "centerH": return { ...s, x: refLeft + (refW - s.w) / 2 };
          case "top": return { ...s, y: refTop };
          case "bottom": return { ...s, y: refBottom - s.h };
          case "centerV": return { ...s, y: refTop + (refH - s.h) / 2 };
          case "distributeH": {
            // 按 x 排序后等间距分布
            const sorted = [...targets].sort((a, b) => a.x - b.x);
            const totalW = sorted.reduce((acc, t) => acc + t.w, 0);
            const gap = (selW - totalW) / Math.max(sorted.length - 1, 1);
            let curX = minX;
            const xMap: Record<string, number> = {};
            sorted.forEach((t) => { xMap[t.id] = curX; curX += t.w + gap; });
            return { ...s, x: xMap[s.id] ?? s.x };
          }
          case "distributeV": {
            const sorted = [...targets].sort((a, b) => a.y - b.y);
            const totalH = sorted.reduce((acc, t) => acc + t.h, 0);
            const gap = (selH - totalH) / Math.max(sorted.length - 1, 1);
            let curY = minY;
            const yMap: Record<string, number> = {};
            sorted.forEach((t) => { yMap[t.id] = curY; curY += t.h + gap; });
            return { ...s, y: yMap[s.id] ?? s.y };
          }
          default: return s;
        }
      });
      return pushHistory({ ...state, slots: updatedSlots });
    }
    // ─── 多选 ───────────────────────────────────────────────────────────
    case "SELECT_SLOTS":
      return { ...state, selectedSlotIds: action.ids };
    default:
      return state;
  }
}

function pushHistory(state: StudioState): StudioState {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({ slots: state.slots, canvas: state.canvas });
  const maxHistory = 50;
  const trimmed =
    newHistory.length > maxHistory
      ? newHistory.slice(newHistory.length - maxHistory)
      : newHistory;
  return {
    ...state,
    history: trimmed,
    historyIndex: trimmed.length - 1,
  };
}

// ─── Context ──────────────────────────────────────────────
interface StudioContextValue {
  state: StudioState;
  dispatch: React.Dispatch<Action>;
  // 便捷方法
  setMode: (mode: EditorMode) => void;
  setZoom: (zoom: number) => void;
  selectSlot: (id: string | null) => void;
  updateSlot: (id: string, updates: Partial<Slot>) => void;
  deleteSelectedSlot: () => void;
  addSlot: (slot: Slot) => void;
  clearSlots: () => void;
  clearAllFills: () => void;
  fillSlot: (slotId: string, assetId: string) => void;
  unfillSlot: (slotId: string) => void;
  autoFill: () => void;
  autoFillOrdered: (assetIds: string[]) => void;
  uploadAssets: (files: FileList) => Promise<Asset[]>;
  addAsset: (asset: Asset) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  removeAssets: (ids: string[]) => void;
  uploadBackground: (file: File) => Promise<void>;
  clearBackground: () => void;
  newCanvas: (width: number, height: number) => void;
  loadPreset: (presetId: string) => void;
  saveScheme: (name: string) => void;
  loadScheme: (scheme: LayoutScheme) => void;
  deleteScheme: (id: string) => void;
  renameScheme: (id: string, name: string) => void;
  undo: () => void;
  redo: () => void;
  exportPng: () => Promise<void>;
  saveAsTemplate: (name: string, author?: string, description?: string) => void;
  importTemplate: (file: File) => Promise<void>;
  /** 模板库：持久化到 IndexedDB 的模板索引列表（不含底图，极小） */
  savedTemplates: TemplateIndex[];
  /** 从模板库加载一个模板到画布 */
  loadTemplateFromLibrary: (localId: string) => void;
  /** 从模板库删除一个模板 */
  deleteTemplateFromLibrary: (localId: string) => void;
  /** 重命名模板库中的模板 */
  renameTemplate: (localId: string, newName: string) => void;
  /** 刷新模板库（从 LocalStorage 重新读取） */
  refreshTemplateLibrary: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedSlot: Slot | null;
  selectedSlotIds: string[];
  // 图层顺序
  reorderSlot: (id: string, direction: "up" | "down" | "top" | "bottom") => void;
  // 复制图框
  duplicateSlot: (id: string) => void;
  // 对齐
  alignSlots: (ids: string[], align: "left" | "centerH" | "right" | "top" | "centerV" | "bottom" | "distributeH" | "distributeV", relativeTo: "selection" | "canvas") => void;
  // 多选
  selectSlots: (ids: string[]) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

   // 模板库状态：从 localStorage 索引层初始化（极小，启动即可用）
  const [savedTemplates, setSavedTemplates] = React.useState<TemplateIndex[]>(() => loadTemplateIndex());
  const refreshTemplateLibrary = useCallback(() => {
    setSavedTemplates(loadTemplateIndex());
  }, []);
  // 启动时迁移旧版 localStorage 数据到 IndexedDB（一次性）
  useEffect(() => {
    migrateFromLegacyStorage().then(() => {
      setSavedTemplates(loadTemplateIndex());
    }).catch(console.warn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;
  const selectedSlot =
    state.slots.find((s) => s.id === state.selectedSlotId) ?? null;

  const setMode = useCallback((mode: EditorMode) => dispatch({ type: "SET_MODE", mode }), []);
  const setZoom = useCallback((zoom: number) => dispatch({ type: "SET_ZOOM", zoom }), []);
  const selectSlot = useCallback((id: string | null) => dispatch({ type: "SELECT_SLOT", id }), []);
  const selectSlots = useCallback((ids: string[]) => dispatch({ type: "SELECT_SLOTS", ids }), []);
  const reorderSlot = useCallback((id: string, direction: "up" | "down" | "top" | "bottom") => {
    dispatch({ type: "REORDER_SLOT", id, direction });
  }, []);
  const duplicateSlot = useCallback((id: string) => {
    dispatch({ type: "DUPLICATE_SLOT", id });
    toast.success("图框已复制");
  }, []);
  const alignSlots = useCallback((
    ids: string[],
    align: "left" | "centerH" | "right" | "top" | "centerV" | "bottom" | "distributeH" | "distributeV",
    relativeTo: "selection" | "canvas"
  ) => {
    dispatch({ type: "ALIGN_SLOTS", ids, align, relativeTo });
  }, []);
  const addSlot = useCallback((slot: Slot) => dispatch({ type: "ADD_SLOT", slot }), []);
  const clearSlots = useCallback(() => dispatch({ type: "CLEAR_SLOTS" }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  const updateSlot = useCallback((id: string, updates: Partial<Slot>) => {
    dispatch({ type: "UPDATE_SLOT", id, updates });
  }, []);

  const deleteSelectedSlot = useCallback(() => {
    if (state.selectedSlotId) {
      dispatch({ type: "DELETE_SLOT", id: state.selectedSlotId });
      toast.success("图框已删除");
    }
  }, [state.selectedSlotId]);

  const fillSlot = useCallback((slotId: string, assetId: string) => {
    dispatch({ type: "FILL_SLOT", slotId, assetId });
  }, []);

  const unfillSlot = useCallback((slotId: string) => {
    dispatch({ type: "UNFILL_SLOT", slotId });
  }, []);

  const autoFill = useCallback(() => {
    dispatch({ type: "AUTO_FILL" });
    toast.success("自动填充完成");
  }, []);
  const clearAllFills = useCallback(() => {
    dispatch({ type: "CLEAR_ALL_FILLS" });
    toast.success("已清空所有图框中的图片");
  }, []);
  const autoFillOrdered = useCallback((assetIds: string[]) => {
    dispatch({ type: "AUTO_FILL_ORDERED", assetIds });
    toast.success("已按顺序自动填充");
  }, []);

  const uploadAssets = useCallback(async (files: FileList): Promise<Asset[]> => {
    const promises = Array.from(files).map(readImageFile);
    try {
      const assets = await Promise.all(promises);
      dispatch({ type: "ADD_ASSETS", assets });
      toast.success(`已上传 ${assets.length} 张照片`);
      return assets;
    } catch {
      toast.error("上传失败，请检查文件格式");
      return [];
    }
  }, []);

  const addAsset = useCallback((asset: Asset) => {
    dispatch({ type: "ADD_ASSETS", assets: [asset] });
  }, []);

  const updateAsset = useCallback((id: string, updates: Partial<Asset>) => {
    dispatch({ type: "UPDATE_ASSET", id, updates });
  }, []);

  const removeAsset = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ASSET", id });
  }, []);

  const removeAssets = useCallback((ids: string[]) => {
    dispatch({ type: "REMOVE_ASSETS", ids });
  }, []);

  const uploadBackground = useCallback(async (file: File) => {
    try {
      const { dataUrl, width, height } = await readBackgroundFile(file);
      dispatch({ type: "SET_BG_IMAGE", dataUrl, width, height });
      toast.success(`底图已设置：${width} × ${height} px`);
    } catch {
      toast.error("底图上传失败");
    }
  }, []);

  const clearBackground = useCallback(() => {
    dispatch({ type: "CLEAR_BG_IMAGE" });
    toast.success("底图已清除");
  }, []);

  const newCanvas = useCallback((width: number, height: number) => {
    dispatch({ type: "NEW_CANVAS", width, height });
    toast.success(`新建画布：${width} × ${height} px`);
  }, []);

  const loadPreset = useCallback((presetId: string) => {
    dispatch({ type: "LOAD_PRESET", presetId });
    const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (preset) toast.success(`已加载预设：${preset.name}`);
  }, []);

  const saveScheme = useCallback((name: string) => {
    dispatch({ type: "SAVE_SCHEME", name });
    toast.success(`方案已保存：${name}`);
  }, []);

  const loadScheme = useCallback((scheme: LayoutScheme) => {
    dispatch({ type: "LOAD_SCHEME", scheme });
    toast.success(`已加载方案：${scheme.name}`);
  }, []);

  const deleteScheme = useCallback((id: string) => {
    dispatch({ type: "DELETE_SCHEME", id });
    toast.success("方案已删除");
  }, []);

  const renameScheme = useCallback((id: string, name: string) => {
    dispatch({ type: "RENAME_SCHEME", id, name });
  }, []);

  const exportPng = useCallback(async () => {
    dispatch({ type: "SET_EXPORTING", value: true });
    try {
      const dataUrl = await exportCanvasToPng(
        state.canvas.width,
        state.canvas.height,
        state.canvas.backgroundImage,
        state.canvas.backgroundColor,
        state.slots,
        state.assets
      );
      const defaultName = `光影集排版-${Date.now()}.png`;
      const result = await electronExportPng(dataUrl, defaultName);
      if (result.success) {
        if (isElectron && result.filePath) {
          toast.success(`导出成功！已保存到: ${result.filePath}`);
        } else {
          toast.success("导出成功！PNG 已下载");
        }
      }
    } catch {
      toast.error("导出失败，请重试");
    } finally {
      dispatch({ type: "SET_EXPORTING", value: false });
    }
  }, [state.canvas, state.slots, state.assets]);

  // 另存为模板：将当前画布+底图+图框打包为 JSON 文件下载
  const saveAsTemplate = useCallback((name: string, author?: string, description?: string) => {
    if (state.slots.length === 0) {
      toast.warning("请先添加至少一个图框再保存模板");
      return;
    }
    try {
      exportTemplate(
        state.canvas.width,
        state.canvas.height,
        state.canvas.backgroundColor,
        state.canvas.backgroundImage,
        state.slots,
        name.trim() || '未命名模板',
        author,
        description
      );
      toast.success(`模板「${name}」已保存并下载！`);
    } catch {
      toast.error("模板保存失败，请重试");
    }
  }, [state.canvas, state.slots]);

  // 导入模板：读取 JSON 文件，恢复画布和图框，并自动持久化到模板库
  const importTemplate = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const tpl = parseTemplateFile(text);
      const newSlots = templateSlotsToSlots(tpl.slots);
      const newCanvas = {
        width: tpl.canvas.width,
        height: tpl.canvas.height,
        backgroundColor: tpl.canvas.backgroundColor || '#ffffff',
        backgroundImage: tpl.canvas.backgroundImage || null,
      };
      // 计算适应缩放比
      const availW = window.innerWidth - 288 - 256 - 128;
      const availH = window.innerHeight - 48 - 28 - 64;
      const fitZoom = Math.min(availW / newCanvas.width, availH / newCanvas.height, 1);
      dispatch({ type: 'SET_CANVAS', canvas: newCanvas });
      dispatch({ type: 'SET_SLOTS', slots: newSlots });
      dispatch({ type: 'SET_ZOOM', zoom: fitZoom });
      dispatch({ type: 'SELECT_SLOT', id: null });

      // 自动持久化到 IndexedDB（导入即保存，不阻塞 UI）
      saveTemplateToDb(tpl).then((entry) => {
        setSavedTemplates(loadTemplateIndex());
        toast.success(`模板「${entry.name}」导入并已保存到模板库！${newSlots.length} 个图框已就位`);
      }).catch(() => {
        toast.success(`模板「${tpl.name}」导入成功！${newSlots.length} 个图框已就位（注：存储失败，模板未保存到库）`);
      });
    } catch (err) {
      toast.error(`导入失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  }, []);

  // 从模板库加载模板到画布（异步读取 IndexedDB 详情层）
  const loadTemplateFromLibrary = useCallback(async (localId: string) => {
    const tpl = await loadTemplateDetail(localId);
    if (!tpl) {
      toast.error('模板不存在或已被删除');
      return;
    }
    const newSlots = templateSlotsToSlots(tpl.slots);
    const newCanvas = {
      width: tpl.canvas.width,
      height: tpl.canvas.height,
      backgroundColor: tpl.canvas.backgroundColor || '#ffffff',
      backgroundImage: tpl.canvas.backgroundImage || null,
    };
    const availW = window.innerWidth - 288 - 256 - 128;
    const availH = window.innerHeight - 48 - 28 - 64;
    const fitZoom = Math.min(availW / newCanvas.width, availH / newCanvas.height, 1);
    dispatch({ type: 'SET_CANVAS', canvas: newCanvas });
    dispatch({ type: 'SET_SLOTS', slots: newSlots });
    dispatch({ type: 'SET_ZOOM', zoom: fitZoom });
    dispatch({ type: 'SELECT_SLOT', id: null });
    toast.success(`已加载模板「${tpl.name}」，请上传照片填充图框`);
  }, []);

  // 从模板库删除模板（异步，同时清除 IndexedDB 详情+缩略图）
  const deleteTemplateFromLibrary = useCallback((localId: string) => {
    deleteFromDb(localId).then(() => {
      setSavedTemplates(loadTemplateIndex());
      toast.success('模板已从库中删除');
    }).catch(() => toast.error('删除失败，请重试'));
  }, []);

  // 重命名模板库中的模板（只更新索引层，同步）
  const renameTemplate = useCallback((localId: string, newName: string) => {
    renameInDb(localId, newName);
    setSavedTemplates(loadTemplateIndex());
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      } else if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        if (state.selectedSlotId) {
          e.preventDefault();
          dispatch({ type: "DUPLICATE_SLOT", id: state.selectedSlotId });
          toast.success("图框已复制");
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (state.selectedSlotId) {
          e.preventDefault();
          dispatch({ type: "DELETE_SLOT", id: state.selectedSlotId });
        }
      } else if (e.key === "Escape") {
        dispatch({ type: "SELECT_SLOT", id: null });
        dispatch({ type: "SET_MODE", mode: "select" });
      } else if (e.key === "v") {
        dispatch({ type: "SET_MODE", mode: "select" });
      } else if (e.key === "r") {
        dispatch({ type: "SET_MODE", mode: "draw" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.selectedSlotId]);

  const value: StudioContextValue = {
    state,
    dispatch,
    setMode,
    setZoom,
    selectSlot,
    updateSlot,
    deleteSelectedSlot,
    addSlot,
    clearSlots,
    clearAllFills,
    fillSlot,
    unfillSlot,
    autoFill,
    autoFillOrdered,
    uploadAssets,
    addAsset,
    updateAsset,
    removeAsset,
    removeAssets,
    uploadBackground,
    clearBackground,
    newCanvas,
    loadPreset,
    saveScheme,
    loadScheme,
    deleteScheme,
    renameScheme,
    undo,
    redo,
    exportPng,
    saveAsTemplate,
    importTemplate,
    savedTemplates,
    loadTemplateFromLibrary,
    deleteTemplateFromLibrary,
    renameTemplate,
    refreshTemplateLibrary,
    canUndo,
    canRedo,
    selectedSlot,
    selectedSlotIds: state.selectedSlotIds,
    reorderSlot,
    duplicateSlot,
    alignSlots,
    selectSlots,
  };

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
