import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { registerSW } from "virtual:pwa-register";

// Aviso de actualización: solo se dispara cuando hay una versión nueva del front.
const updateSW = registerSW({
  onNeedRefresh() {
    window.__needRefresh = true;
    window.dispatchEvent(new CustomEvent("pwa:need-refresh"));
  },
  onOfflineReady() {}
});
window.__updateSW = () => updateSW(true); // activa la versión nueva y recarga

createRoot(document.getElementById("root")).render(<App />);
