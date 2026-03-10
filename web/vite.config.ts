import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Electron 桌面版 Vite 配置
// 去除了 Manus 专用插件（vite-plugin-manus-runtime、vite-plugin-jsx-loc）
// 构建输出到 ../dist（供 Electron main.js 加载）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Electron 加载 file:// 协议，必须使用相对路径
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "../web-shared"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "../dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // 避免文件名哈希过长
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
