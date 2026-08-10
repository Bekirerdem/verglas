import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import App from "./App";

// No service worker on the landing — a cached shell against redeployed
// hashed assets is a white page (lived twice; never again). Any worker a
// past visit installed gets unregistered and its caches purged, so every
// poisoned browser heals on its next load.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length === 0) return;
    Promise.all(regs.map((r) => r.unregister()))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => location.reload())
      .catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
