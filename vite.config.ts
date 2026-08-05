/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Capacitor copies from here into the native projects.
    outDir: "build",
  },
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    // e2e/ is Playwright's; vitest would otherwise pick up its .spec.ts files.
    exclude: ["node_modules", "build", "e2e"],
    // The prayer timetables are published as UK local times and the app
    // indexes them by the device's local date, so the suite is pinned to the
    // timezone the app is actually for. See README "Known issues" for the
    // travelling-user case this papers over.
    env: { TZ: "Europe/London" },
  },
});
