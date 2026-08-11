import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../lib/i18n";
import { CheckPage } from "./CheckPage";
import "../theme.css";
import "./check.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <CheckPage />
    </I18nProvider>
  </StrictMode>,
);
