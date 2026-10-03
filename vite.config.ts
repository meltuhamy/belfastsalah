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
    // Deliberately not pinned. The app reads and renders the timetable in its
    // own zone, so the suite has to pass wherever the machine happens to be -
    // run it under several with npm run test:zones.
    env: { TZ: process.env.TZ ?? "Europe/London" },
  },
});
