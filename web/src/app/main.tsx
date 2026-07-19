import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "../theme.css";
import "./app.css";
import AppRoot from "./AppRoot";

registerSW({
  immediate: true,
  // Long-lived tabs (event screens) poll for new deploys so nobody needs
  // a manual hard refresh to see the current console.
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update(), 60_000);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
