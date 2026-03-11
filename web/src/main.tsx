import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Electron file:// 协议下 hash 为空时直接赋值 #/
// 直接赋值 location.hash 不会触发页面重新加载，只更新 hash
// wouter 的 useHashLocation 初始化时就能读到正确的 "/"，不会闪现 404
const h = window.location.hash;
if (!h || h === "" || h === "#") {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
