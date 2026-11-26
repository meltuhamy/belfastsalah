import { afterEach, describe, expect, it, vi } from "vitest";

const { setStyle, state } = vi.hoisted(() => ({
  setStyle: vi.fn(),
  state: { native: true, platform: "android" },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => state.native,
    getPlatform: () => state.platform,
  },
  SystemBars: { setStyle },
  SystemBarsStyle: { Dark: "DARK", Light: "LIGHT" },
}));

import {
  applyStatusBarStyle,
  pageUnderSystemBars,
  systemBarsStyle,
} from "./statusBar";

const WEBVIEW_133 =
  "Mozilla/5.0 (Linux; Android 15; CPH2747 Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/133.0.6943.137 Mobile Safari/537.36";
const WEBVIEW_141 =
  "Mozilla/5.0 (Linux; Android 15; CPH2747 Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.70 Mobile Safari/537.36";
const ANDROID_14 =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/133.0.6943.137 Mobile Safari/537.36";

const ORIGINAL_NAVIGATOR = globalThis.navigator;

afterEach(() => {
  setStyle.mockReset();
  state.native = true;
  state.platform = "android";
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: ORIGINAL_NAVIGATOR,
  });
});

describe("pageUnderSystemBars", () => {
  it("Should be true on iOS, where the page always draws behind the bar", () => {
    expect(pageUnderSystemBars("ios", "")).toBe(true);
  });

  it("Should be true on Android 15+ only with a WebView that can pass insets through", () => {
    expect(pageUnderSystemBars("android", WEBVIEW_141)).toBe(true);
    // Capacitor pads the page with an older WebView, so the bar is the
    // window's background, not the app's.
    expect(pageUnderSystemBars("android", WEBVIEW_133)).toBe(false);
    // Android 14 windows do not draw behind the bars at all.
    expect(pageUnderSystemBars("android", ANDROID_14)).toBe(false);
  });
});

describe("systemBarsStyle", () => {
  it("Should follow the app palette on iOS", () => {
    expect(systemBarsStyle("ios", "", true)).toBe("DARK");
    expect(systemBarsStyle("ios", "", false)).toBe("LIGHT");
  });

  it("Should follow the app palette when the page is behind the bars", () => {
    expect(systemBarsStyle("android", WEBVIEW_141, true)).toBe("DARK");
    expect(systemBarsStyle("android", WEBVIEW_141, false)).toBe("LIGHT");
  });

  it("Should leave a padded Android 15+ bar to the device", () => {
    // Its background is the window background, which already follows the
    // device's appearance.
    expect(systemBarsStyle("android", WEBVIEW_133, true)).toBeNull();
    expect(systemBarsStyle("android", WEBVIEW_133, false)).toBeNull();
  });

  it("Should ask for light icons on Android 14's own dark bar", () => {
    // That bar does not follow the app or the device.
    expect(systemBarsStyle("android", ANDROID_14, true)).toBe("DARK");
    expect(systemBarsStyle("android", ANDROID_14, false)).toBe("DARK");
  });

  it("Should do nothing on the web", () => {
    expect(systemBarsStyle("web", "", true)).toBeNull();
  });
});

describe("applyStatusBarStyle", () => {
  it("Should apply the style the platform asks for", async () => {
    state.platform = "ios";
    await applyStatusBarStyle(false);
    expect(setStyle).toHaveBeenLastCalledWith({ style: "LIGHT" });
  });

  it("Should not call the plugin when the system's choice is right", async () => {
    // An Android 15 device with an older WebView: its bar follows the device.
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { userAgent: WEBVIEW_133 },
    });
    await applyStatusBarStyle(true);
    expect(setStyle).not.toHaveBeenCalled();
  });

  it("Should do nothing in a browser, where there is no system bar", async () => {
    state.native = false;
    await applyStatusBarStyle(true);
    expect(setStyle).not.toHaveBeenCalled();
  });

  it("Should not reject when the plugin cannot style the bars", async () => {
    state.platform = "ios";
    setStyle.mockRejectedValueOnce(new Error("unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(applyStatusBarStyle(false)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
