import { defineConfig, devices } from "@playwright/test";

// Ionic renders its form controls into shadow DOM, and whether a click on the
// surrounding row reaches the control is a real-browser concern that jsdom
// cannot answer. These tests exist for that class of bug specifically; unit
// tests live in src/ and run under vitest.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    // The app shows extra timezone controls when the device's clock differs
    // from the timetable's, so leaving this to the runner's clock would make
    // most of these tests behave differently on a US machine, or in winter.
    // Specs about that behaviour set their own zone with test.use.
    timezoneId: "Europe/London",
    // Likewise the clock: the time format defaults to System, which on the web
    // follows the locale, and Playwright's default en-US is a 12-hour one. The
    // timetable prints a 24-hour clock, so the specs read it in en-GB.
    locale: "en-GB",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        // CI installs its own browsers, so Playwright resolves them itself.
        // Set CHROMIUM_PATH to reuse a Chromium that is already on the machine
        // instead (handy in sandboxes that ship one at a fixed location).
        launchOptions: {
          // Sky V2 draws with WebGL. Headless Chrome has no GPU, and newer
          // versions only fall back to SwiftShader's software WebGL when
          // asked.
          args: ["--enable-unsafe-swiftshader"],
          ...(process.env.CHROMIUM_PATH
            ? { executablePath: process.env.CHROMIUM_PATH }
            : {}),
        },
      },
    },
  ],
  webServer: {
    command: "npx vite --port 5173 --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
