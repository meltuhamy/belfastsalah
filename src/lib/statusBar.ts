import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

/**
 * Whether the page is drawn behind the system bars, so their icons sit on the
 * app's own background.
 *
 * Capacitor 8.5's SystemBars plugin passes the window insets through only when
 * it can correct the WebView's safe-area bug - Android WebView 140 and later -
 * and the page opts in with `viewport-fit=cover`, which index.html does.
 * Otherwise it pads the page below the bars, and the bar shows the window's own
 * background instead of the app's. On Android 14 and older the window does not
 * draw behind the bars at all.
 */
export function pageUnderSystemBars(platform: string, userAgent: string): boolean {
  if (platform === "ios") {
    return true;
  }
  if (platform !== "android") {
    return false;
  }
  return androidMajor(userAgent) >= 15 && webViewMajor(userAgent) >= 140;
}

function androidMajor(userAgent: string): number {
  return Number((/Android (\d+)/.exec(userAgent) ?? [])[1] ?? 0);
}

function webViewMajor(userAgent: string): number {
  return Number((/Chrome\/(\d+)/.exec(userAgent) ?? [])[1] ?? 0);
}

/**
 * The style to ask the system bars for, or null to leave the system's own
 * choice alone.
 *
 * On iOS, and on Android when the page is behind the bars, the icons sit on
 * the app's own background, so they follow the app's palette rather than the
 * device's. Where the page is padded, the bar is the window's background: on
 * Android 15+ that follows the device, so DEFAULT (null) is already readable,
 * while on Android 14 and older it is the theme's own dark status bar whatever
 * the app shows, and only light icons read on it.
 */
export function systemBarsStyle(
  platform: string,
  userAgent: string,
  dark: boolean
): SystemBarsStyle | null {
  if (platform !== "android") {
    return platform === "ios"
      ? dark
        ? SystemBarsStyle.Dark
        : SystemBarsStyle.Light
      : null;
  }
  if (pageUnderSystemBars(platform, userAgent)) {
    return dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
  }
  return androidMajor(userAgent) >= 15 ? null : SystemBarsStyle.Dark;
}

/**
 * Keeps the phone's status bar icons readable against whatever is behind them.
 *
 * Left alone, the bars follow the device's light/dark setting, not the app's
 * theme - so app Light on a device set to dark put light icons on the app's
 * near-white page, and app Dark on a light device put dark icons on its
 * near-black one. Called with the same `dark` that chooses the palette, so the
 * two can never disagree, and again whenever it changes (Sky flips at Maghrib).
 *
 * A failure here is cosmetic, and on the web there is no system bar at all,
 * so neither is worth surfacing.
 */
export async function applyStatusBarStyle(dark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  const style = systemBarsStyle(
    Capacitor.getPlatform(),
    globalThis.navigator?.userAgent ?? "",
    dark
  );
  if (style === null) {
    return;
  }
  try {
    await SystemBars.setStyle({ style });
  } catch (error) {
    console.warn("Could not style the system bars", error);
  }
}
