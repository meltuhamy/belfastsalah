/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

/**
 * The commit this build is made from, short, for the Version row in
 * settings. APP_COMMIT wins where the checkout is not the commit wanted -
 * a pull request's merge commit, say.
 */
function commit(): string {
  if (process.env.APP_COMMIT) return process.env.APP_COMMIT.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_COMMIT__: JSON.stringify(commit()),
  },
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
