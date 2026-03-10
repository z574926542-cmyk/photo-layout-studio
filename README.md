# 奇妙奇遇光影集 - 排版 Studio

> 专业照片排版工具 · 完全离线运行 · 本地数据持久化

---

## 目录结构

```
photo-layout-studio-desktop/
├── electron/
│   ├── main.js          # Electron 主进程（窗口管理、IPC、文件操作）
│   └── preload.js       # 安全桥接脚本（暴露 window.electronAPI）
├── web/                 # React 前端源码
│   ├── src/
│   │   ├── components/  # UI 组件（StudioCanvas、RightPanel、CropModal 等）
│   │   ├── contexts/    # 全局状态（StudioContext.tsx）
│   │   ├── lib/
│   │   │   ├── electronBridge.ts  # Electron IPC 桥接层（兼容浏览器降级）
│   │   │   ├── utils.ts           # 工具函数（exportCanvasToPng 等）
│   │   │   └── types.ts           # TypeScript 类型定义
│   │   └── pages/       # 页面组件
│   ├── vite.config.ts   # Vite 构建配置（base: "./" 支持 file:// 协议）
│   └── package.json
├── web-shared/          # 共享类型定义
├── assets/
│   └── icon.png         # 应用图标
├── dist/                # 前端构建产物（由 pnpm build 生成）
├── release/             # 打包产物（由 electron-builder 生成）
│   ├── 光影集排版Studio-1.0.0.AppImage   # Linux 安装包
│   └── linux-unpacked/                   # Linux 解包版本
└── package.json         # Electron 项目配置（含 electron-builder 配置）
```

---

## 数据保存说明

应用数据保存在系统用户目录下，**关闭软件后数据仍然保留**：

| 平台 | 数据目录 |
|------|---------|
| Windows | `C:\Users\<用户名>\AppData\Roaming\光影集排版Studio\data\` |
| macOS | `~/Library/Application Support/光影集排版Studio/data/` |
| Linux | `~/.config/光影集排版Studio/data/` |

数据目录结构：
```
data/
├── last-state.json    # 上次工作状态（画布、图框、素材等，自动保存）
├── settings.json      # 用户设置
└── projects/          # 保存的项目文件（.json）
```

> 菜单 → 帮助 → 数据目录，可直接打开数据文件夹。

---

## 本地运行（开发模式）

### 前提条件

- Node.js 18+
- pnpm 8+（`npm install -g pnpm`）

### 步骤

```bash
# 1. 进入项目目录
cd photo-layout-studio-desktop

# 2. 安装 Electron 依赖
npm install

# 3. 安装前端依赖
cd web && pnpm install && cd ..

# 4. 构建前端
cd web && pnpm build && cd ..

# 5. 启动 Electron（生产模式，加载 dist/index.html）
NODE_ENV=production npx electron .

# 或者开发模式（需要先启动 Vite 开发服务器）
# 终端 1：cd web && pnpm dev
# 终端 2：NODE_ENV=development npx electron .
```

---

## 打包命令

### Linux（AppImage）

```bash
cd photo-layout-studio-desktop
cd web && pnpm build && cd ..
npm run build:linux
# 产物：release/光影集排版Studio-1.0.0.AppImage
```

### Windows（NSIS 安装包 + 便携版）

```bash
# 在 Windows 机器上执行，或使用 Wine/Docker 交叉编译
cd photo-layout-studio-desktop
cd web && pnpm build && cd ..
npm run build:win
# 产物：
#   release/光影集排版Studio Setup 1.0.0.exe   （NSIS 安装包）
#   release/光影集排版Studio 1.0.0.exe          （便携版，无需安装）
```

### macOS（DMG）

```bash
# 必须在 macOS 机器上执行
cd photo-layout-studio-desktop
cd web && pnpm build && cd ..
npm run build:mac
# 产物：release/光影集排版Studio-1.0.0.dmg
```

---

## Windows 安装说明

1. 下载 `光影集排版Studio Setup 1.0.0.exe`
2. 双击运行安装程序
3. 选择安装目录（默认 `C:\Program Files\光影集排版Studio`）
4. 完成安装后，桌面和开始菜单会出现快捷方式
5. 双击启动即可，**无需联网**

> 如果 Windows Defender 弹出警告，点击「更多信息」→「仍要运行」即可（因为未购买代码签名证书）。

---

## macOS 安装说明

1. 下载 `光影集排版Studio-1.0.0.dmg`
2. 双击打开 DMG，将应用拖入 Applications 文件夹
3. 首次运行时，右键点击应用 → 打开（绕过 Gatekeeper）
4. 后续直接双击启动即可，**无需联网**

---

## Linux 安装说明

```bash
# 给 AppImage 添加执行权限
chmod +x 光影集排版Studio-1.0.0.AppImage

# 直接运行（无需安装）
./光影集排版Studio-1.0.0.AppImage

# 或者双击文件管理器中的 AppImage 文件
```

---

## 功能验证清单

| 功能 | 桌面版状态 | 说明 |
|------|-----------|------|
| 完全离线运行 | ✅ | 所有资源本地化，无外部依赖 |
| 素材上传 | ✅ | FileReader API，支持 JPG/PNG/WebP |
| 素材预处理裁剪 | ✅ | 裁剪状态持久化到 Asset.cropRect |
| 裁剪状态恢复 | ✅ | 再次打开裁剪弹窗自动恢复上次裁剪框 |
| Contain 填充逻辑 | ✅ | 图片完整显示，不裁剪内容 |
| PNG 导出 | ✅ | Electron 弹出系统保存对话框，写入本地文件 |
| 模板导入导出 | ✅ | JSON 文件，通过系统文件对话框操作 |
| 底图保存 | ✅ | Base64 内嵌在项目状态中 |
| Logo 显示 | ✅ | 本地图片资源，完全离线 |
| 工作状态自动保存 | ✅ | 关闭软件后重新打开，恢复上次状态 |
| 项目文件保存 | ✅ | 菜单 → 文件 → 保存项目 |
| 原生菜单 | ✅ | 文件/编辑/视图/帮助菜单 |
| 键盘快捷键 | ✅ | Ctrl+Z 撤销、Ctrl+E 导出等 |

---

## 模板导入导出说明

**导出模板**（在应用内）：
1. 设置好画布尺寸和图框布局
2. 右侧面板 → 模板库 → 保存为模板
3. 输入模板名称，点击保存
4. 模板文件（`.json`）会下载到本地

**导入模板**：
1. 右侧面板 → 模板库 → 导入模板
2. 选择 `.json` 模板文件
3. 画布自动切换为模板布局

**模板文件格式**（可手动编辑）：
```json
{
  "_type": "photo-layout-template",
  "version": 1,
  "name": "模板名称",
  "canvas": { "width": 1200, "height": 900, "backgroundColor": "#ffffff" },
  "slots": [
    { "x": 1, "y": 1, "w": 48.5, "h": 98, "label": "左图" },
    { "x": 51, "y": 1, "w": 48.5, "h": 98, "label": "右图" }
  ]
}
```

---

## 关于 Windows/macOS 打包

由于沙箱环境为 Linux，**无法直接生成 Windows .exe 和 macOS .dmg**（需要对应平台的操作系统）。

**Windows 打包方案**（二选一）：
1. 在 Windows 机器上克隆源码，执行 `npm run build:win`
2. 使用 GitHub Actions CI 自动构建（推荐）

**macOS 打包方案**：
1. 在 Mac 机器上克隆源码，执行 `npm run build:mac`
2. 使用 GitHub Actions CI（macOS runner）自动构建

**GitHub Actions 配置示例**已包含在 `.github/workflows/build.yml` 中（见下方）。

---

## GitHub Actions 自动构建（推荐）

将源码推送到 GitHub 后，创建 `.github/workflows/build.yml`：

```yaml
name: Build Desktop App

on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: pnpm/action-setup@v4
        with: { version: '9' }
      - run: npm install
      - run: cd web && pnpm install && pnpm build && cd ..
      - run: npm run build:win
      - uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: release/*.exe

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: pnpm/action-setup@v4
        with: { version: '9' }
      - run: npm install
      - run: cd web && pnpm install && pnpm build && cd ..
      - run: npm run build:mac
      - uses: actions/upload-artifact@v4
        with:
          name: macos-dmg
          path: release/*.dmg
```

推送 tag（如 `v1.0.0`）后，GitHub Actions 会自动构建 Windows 和 macOS 安装包，可在 Actions 页面下载。
