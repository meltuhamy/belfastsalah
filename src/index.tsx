import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppContextProvider } from "./State";
import { followSystemTextScale } from "./lib/textScale";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container not found");
}

// Before the first render, so the first frame is already at the right size.
followSystemTextScale();

createRoot(container).render(
  <React.StrictMode>
    <AppContextProvider>
      <App />
    </AppContextProvider>
  </React.StrictMode>
);
