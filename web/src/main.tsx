import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./theme.css";
import App from "./App";

// Register the service worker from the landing too, so the site is
// installable no matter which page a visitor enters from.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update(), 60_000);
  },
});

// autoUpdate swaps the worker under a running page and purges the old
// precache — an old bundle against an empty cache is a black screen.
// Reload once when a NEW worker takes over (never on first install).
if ("serviceWorker" in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
