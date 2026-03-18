/**
 * 奇妙奇遇光影集 - 排版 Studio
 * Electron 主进程
 * 功能：窗口管理、IPC 通信、本地数据持久化、文件系统操作
 */
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── 数据目录 ─────────────────────────────────────────────────
// Windows: C:\Users\<用户名>\AppData\Roaming\光影集排版Studio
// macOS:   ~/Library/Application Support/光影集排版Studio
// Linux:   ~/.config/光影集排版Studio
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');   // 素材图片（base64 存储）
const PROJECTS_DIR = path.join(DATA_DIR, 'projects'); // 项目文件
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates'); // 模板库
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const STATE_FILE = path.join(DATA_DIR, 'last-state.json'); // 上次工作状态
const TEMPLATE_INDEX_FILE = path.join(DATA_DIR, 'templates', '_index.json');

// 确保数据目录存在
function ensureDirs() {
  [DATA_DIR, ASSETS_DIR, PROJECTS_DIR, TEMPLATES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// ─── 窗口创建 ─────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  ensureDirs();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: '奇妙奇遇光影集 - 排版 Studio',
    icon: path.join(__dirname, '../assets/icon.png'),
    backgroundColor: '#0f0f18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // 允许加载本地 file:// 资源
    },
    show: false, // 等待 ready-to-show 再显示，避免白屏
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // 加载应用
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 设置菜单
  setupMenu();
}

// ─── 应用菜单 ─────────────────────────────────────────────────
function setupMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建画布', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu-new') },
        { type: 'separator' },
        { label: '导入素材...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu-import') },
        { label: '导出 PNG...', accelerator: 'CmdOrCtrl+E', click: () => mainWindow?.webContents.send('menu-export') },
        { type: 'separator' },
        { label: '保存项目', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu-save') },
        { label: '另存为...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send('menu-save-as') },
        { label: '打开项目...', accelerator: 'CmdOrCtrl+Shift+O', click: () => mainWindow?.webContents.send('menu-open') },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu-undo') },
        { label: '重做', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow?.webContents.send('menu-redo') },
        { type: 'separator' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '数据目录',
          click: () => shell.openPath(DATA_DIR),
        },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '奇妙奇遇光影集 - 排版 Studio',
              detail: `版本: 1.0.0\n完全离线运行\n数据目录: ${DATA_DIR}`,
              icon: path.join(__dirname, '../assets/icon.png'),
            });
          },
        },
      ],
    },
  ];

  // macOS 需要在最前面加 App 菜单
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC 处理器：数据持久化 ───────────────────────────────────

// 保存上次工作状态（画布状态、素材列表等）
ipcMain.handle('save-state', async (event, stateJson) => {
  try {
    fs.writeFileSync(STATE_FILE, stateJson, 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 加载上次工作状态
ipcMain.handle('load-state', async () => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return { success: true, data };
    }
    return { success: true, data: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 保存设置
ipcMain.handle('save-settings', async (event, settingsJson) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, settingsJson, 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 加载设置
ipcMain.handle('load-settings', async () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { success: true, data };
    }
    return { success: true, data: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 保存项目文件
ipcMain.handle('save-project', async (event, { name, projectJson }) => {
  try {
    const filePath = path.join(PROJECTS_DIR, `${name}.json`);
    fs.writeFileSync(filePath, projectJson, 'utf-8');
    return { success: true, filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 另存为（弹出保存对话框）
ipcMain.handle('save-project-as', async (event, projectJson) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存项目',
      defaultPath: path.join(PROJECTS_DIR, '我的排版.json'),
      filters: [{ name: '光影集项目', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    fs.writeFileSync(result.filePath, projectJson, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 打开项目文件
ipcMain.handle('open-project', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '打开项目',
      defaultPath: PROJECTS_DIR,
      filters: [{ name: '光影集项目', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
    const data = fs.readFileSync(result.filePaths[0], 'utf-8');
    return { success: true, data, filePath: result.filePaths[0] };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 列出所有保存的项目
ipcMain.handle('list-projects', async () => {
  try {
    const files = fs.readdirSync(PROJECTS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f.replace('.json', ''),
        path: path.join(PROJECTS_DIR, f),
        mtime: fs.statSync(path.join(PROJECTS_DIR, f)).mtime.toISOString(),
      }))
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    return { success: true, projects: files };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 导出 PNG（弹出保存对话框）
ipcMain.handle('export-png', async (event, { dataUrl, defaultName }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出 PNG',
      defaultPath: path.join(os.homedir(), 'Desktop', defaultName || '光影集排版.png'),
      filters: [{ name: 'PNG 图片', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };

    // 将 base64 dataUrl 写入文件
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 获取数据目录路径
ipcMain.handle('get-data-dir', async () => {
  return { dataDir: DATA_DIR, assetsDir: ASSETS_DIR, projectsDir: PROJECTS_DIR, templatesDir: TEMPLATES_DIR };
});

// ─── 模板库文件系统操作 ───────────────────────────────────────

// 读取模板索引
ipcMain.handle('template-load-index', async () => {
  try {
    if (fs.existsSync(TEMPLATE_INDEX_FILE)) {
      const data = fs.readFileSync(TEMPLATE_INDEX_FILE, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: true, data: [] };
  } catch (e) {
    return { success: false, error: e.message, data: [] };
  }
});

// 保存模板索引
ipcMain.handle('template-save-index', async (event, indexJson) => {
  try {
    fs.writeFileSync(TEMPLATE_INDEX_FILE, indexJson, 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 读取单个模板详情
ipcMain.handle('template-load-detail', async (event, id) => {
  try {
    const filePath = path.join(TEMPLATES_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: false, error: 'not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 保存单个模板详情
ipcMain.handle('template-save-detail', async (event, { id, template }) => {
  try {
    const filePath = path.join(TEMPLATES_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(template), 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 删除单个模板
ipcMain.handle('template-delete', async (event, id) => {
  try {
    const filePath = path.join(TEMPLATES_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── 应用生命周期 ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 阻止导航到外部链接
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'file:' && !url.startsWith('http://localhost')) {
      event.preventDefault();
    }
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
