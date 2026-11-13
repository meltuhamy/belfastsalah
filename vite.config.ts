/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Capacitor copies from here into the native projects.
    outDir: "build",
    // The oldest engines the app is known to run on: Android System WebView
    // 101 (MEL-150) and Safari on iOS 15, the app's deployment target. Vite's
    // default is Chrome 111 / Safari 16.4, which lets through syntax those
    // ignore, such as `@media (width <= 375px)`. This lowers syntax only -
    // keeping to library methods they have is tsconfig's `lib`.
    target: ["chrome101", "safari15"],
  },
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    // Per-file jsdom setup is the largest cost in the suite, and only the
    // files that render anything need a document. Those opt back in with
    // an `@vitest-environment jsdom` comment.
    environment: "node",
    setupFiles: "./src/setupTests.ts",
    // e2e/ is Playwright's; vitest would otherwise pick up its .spec.ts files.
    exclude: ["node_modules", "build", "e2e"],
    // Deliberately not pinned. The app reads and renders the timetable in its
    // own zone, so the suite has to pass wherever the machine happens to be -
    // run it under several with npm run test:zones.
    env: { TZ: process.env.TZ ?? "Europe/London" },
  },
});
