import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppContextProvider } from "./State";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container not found");
}

createRoot(container).render(
  <React.StrictMode>
    <AppContextProvider>
      <App />
    </AppContextProvider>
  </React.StrictMode>
);
