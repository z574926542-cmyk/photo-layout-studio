/**
 * 奇妙奇遇光影集 - 排版 Studio
 * Electron IPC 桥接层
 * 
 * 在 Electron 环境中使用 IPC 与主进程通信
 * 在浏览器环境中降级为 localStorage
 */

// 检测是否在 Electron 环境中运行
export const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

// 获取 electronAPI（类型安全）
function getAPI() {
  return (window as any).electronAPI as {
    saveState: (json: string) => Promise<{ success: boolean; error?: string }>;
    loadState: () => Promise<{ success: boolean; data: string | null; error?: string }>;
    saveSettings: (json: string) => Promise<{ success: boolean }>;
    loadSettings: () => Promise<{ success: boolean; data: string | null }>;
    saveProject: (name: string, json: string) => Promise<{ success: boolean; filePath?: string }>;
    saveProjectAs: (json: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
    openProject: () => Promise<{ success: boolean; data?: string; filePath?: string; canceled?: boolean }>;
    listProjects: () => Promise<{ success: boolean; projects?: Array<{ name: string; path: string; mtime: string }> }>;
    exportPng: (dataUrl: string, defaultName: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
    getDataDir: () => Promise<{ dataDir: string; assetsDir: string; projectsDir: string }>;
    onMenuAction: (callback: (action: string) => void) => () => void;
    platform: string;
  } | null;
}

// ─── 状态持久化 ───────────────────────────────────────────────

const STORAGE_KEY_STATE = 'photo-layout-studio:state';
const STORAGE_KEY_SETTINGS = 'photo-layout-studio:settings';

/**
 * 保存工作状态（自动保存）
 * Electron: 写入 userData/data/last-state.json
 * 浏览器: 写入 localStorage
 */
export async function saveState(state: object): Promise<void> {
  const json = JSON.stringify(state);
  if (isElectron) {
    const api = getAPI();
    if (api) await api.saveState(json);
  } else {
    try {
      localStorage.setItem(STORAGE_KEY_STATE, json);
    } catch (e) {
      console.warn('localStorage 保存失败（可能超出配额）:', e);
    }
  }
}

/**
 * 加载上次工作状态
 */
export async function loadState<T>(): Promise<T | null> {
  if (isElectron) {
    const api = getAPI();
    if (!api) return null;
    const result = await api.loadState();
    if (result.success && result.data) {
      try { return JSON.parse(result.data) as T; } catch { return null; }
    }
    return null;
  } else {
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
}

/**
 * 保存设置
 */
export async function saveSettings(settings: object): Promise<void> {
  const json = JSON.stringify(settings);
  if (isElectron) {
    const api = getAPI();
    if (api) await api.saveSettings(json);
  } else {
    localStorage.setItem(STORAGE_KEY_SETTINGS, json);
  }
}

/**
 * 加载设置
 */
export async function loadSettings<T>(): Promise<T | null> {
  if (isElectron) {
    const api = getAPI();
    if (!api) return null;
    const result = await api.loadSettings();
    if (result.success && result.data) {
      try { return JSON.parse(result.data) as T; } catch { return null; }
    }
    return null;
  } else {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
}

// ─── 项目文件操作 ─────────────────────────────────────────────

/**
 * 保存项目（另存为对话框）
 */
export async function saveProjectAs(projectData: object): Promise<{ success: boolean; filePath?: string }> {
  const json = JSON.stringify(projectData, null, 2);
  if (isElectron) {
    const api = getAPI();
    if (!api) return { success: false };
    return await api.saveProjectAs(json);
  } else {
    // 浏览器：触发下载
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '光影集排版.json';
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }
}

/**
 * 打开项目文件
 */
export async function openProject(): Promise<{ success: boolean; data?: object; canceled?: boolean }> {
  if (isElectron) {
    const api = getAPI();
    if (!api) return { success: false };
    const result = await api.openProject();
    if (result.success && result.data) {
      try {
        return { success: true, data: JSON.parse(result.data) };
      } catch {
        return { success: false };
      }
    }
    return { success: false, canceled: result.canceled };
  } else {
    // 浏览器：file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) { resolve({ success: false, canceled: true }); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            resolve({ success: true, data });
          } catch {
            resolve({ success: false });
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }
}

/**
 * 列出所有保存的项目
 */
export async function listProjects(): Promise<Array<{ name: string; path: string; mtime: string }>> {
  if (isElectron) {
    const api = getAPI();
    if (!api) return [];
    const result = await api.listProjects();
    return result.success ? (result.projects ?? []) : [];
  }
  return [];
}

// ─── PNG 导出 ─────────────────────────────────────────────────

/**
 * 导出 PNG
 * Electron: 弹出系统保存对话框，写入文件
 * 浏览器: 触发浏览器下载
 */
export async function exportPng(dataUrl: string, defaultName = '光影集排版.png'): Promise<{ success: boolean; filePath?: string }> {
  if (isElectron) {
    const api = getAPI();
    if (!api) return { success: false };
    return await api.exportPng(dataUrl, defaultName);
  } else {
    // 浏览器降级：触发下载
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = defaultName;
    a.click();
    return { success: true };
  }
}

// ─── 菜单事件 ─────────────────────────────────────────────────

/**
 * 监听原生菜单事件（仅 Electron）
 */
export function onMenuAction(callback: (action: string) => void): () => void {
  if (isElectron) {
    const api = getAPI();
    if (api) return api.onMenuAction(callback);
  }
  return () => {};
}

// ─── 工具 ─────────────────────────────────────────────────────

/**
 * 获取数据目录路径（仅 Electron）
 */
export async function getDataDir(): Promise<{ dataDir: string; assetsDir: string; projectsDir: string } | null> {
  if (isElectron) {
    const api = getAPI();
    if (api) return await api.getDataDir();
  }
  return null;
}
