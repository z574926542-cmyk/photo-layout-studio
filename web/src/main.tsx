import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Electron file:// 协议下 hash 为空时强制跳转到 #/，避免 404 闪现
if (!window.location.hash || window.location.hash === '#') {
  window.location.replace(window.location.href.split('#')[0] + '#/');
}

createRoot(document.getElementById("root")!).render(<App />);
