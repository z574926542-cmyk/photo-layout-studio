/**
 * 奇妙奇遇光影集 - 排版 Studio
 * Electron Preload 脚本
 * 安全地将 Node.js/Electron API 暴露给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

// 暴露给前端的 API（通过 window.electronAPI 访问）
contextBridge.exposeInMainWorld('electronAPI', {
  // ─── 状态持久化 ─────────────────────────────────────────
  // 保存上次工作状态（自动保存，关闭后恢复）
  saveState: (stateJson) => ipcRenderer.invoke('save-state', stateJson),
  loadState: () => ipcRenderer.invoke('load-state'),

  // ─── 设置 ───────────────────────────────────────────────
  saveSettings: (settingsJson) => ipcRenderer.invoke('save-settings', settingsJson),
  loadSettings: () => ipcRenderer.invoke('load-settings'),

  // ─── 项目文件 ───────────────────────────────────────────
  saveProject: (name, projectJson) => ipcRenderer.invoke('save-project', { name, projectJson }),
  saveProjectAs: (projectJson) => ipcRenderer.invoke('save-project-as', projectJson),
  openProject: () => ipcRenderer.invoke('open-project'),
  listProjects: () => ipcRenderer.invoke('list-projects'),

  // ─── 导出 ───────────────────────────────────────────────
  exportPng: (dataUrl, defaultName) => ipcRenderer.invoke('export-png', { dataUrl, defaultName }),

  // ─── 工具 ───────────────────────────────────────────────
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),

  // ─── 菜单事件监听 ────────────────────────────────────────
  onMenuAction: (callback) => {
    const actions = ['menu-new', 'menu-import', 'menu-export', 'menu-save', 'menu-save-as', 'menu-open', 'menu-undo', 'menu-redo'];
    const listeners = actions.map(action => {
      const listener = () => callback(action);
      ipcRenderer.on(action, listener);
      return { action, listener };
    });
    // 返回清理函数
    return () => listeners.forEach(({ action, listener }) => ipcRenderer.removeListener(action, listener));
  },

  // ─── 环境检测 ───────────────────────────────────────────
  isElectron: true,
  platform: process.platform, // 'win32' | 'darwin' | 'linux'
});
