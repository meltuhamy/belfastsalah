import React from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { AppContextProvider } from "./State";

/*
  Ionic turns the root font size into iOS's Dynamic Type body size, which at
  the accessibility sizes is around 53px - every rem-based control scales with
  it, and Settings stops being usable. Cap it: text still grows from the
  default size to this cap, and everything that follows the root keeps
  following it below the cap. Android's WebView already applies its own font
  scale to the computed sizes, so no cap is needed there.
*/
if (Capacitor.getPlatform() === "ios") {
  const root = document.documentElement;
  if (Number.parseFloat(getComputedStyle(root).fontSize) > 30) {
    root.style.fontSize = "30px";
  }
}

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
