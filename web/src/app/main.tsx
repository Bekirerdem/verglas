import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "../theme.css";
import "./app.css";
import AppRoot from "./AppRoot";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
