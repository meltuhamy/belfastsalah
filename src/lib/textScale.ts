/**
 * The system text size, as one number the CSS scales by (MEL-105).
 *
 * Each platform says how big the reader wants text in its own way, and none of
 * them, left alone, does what the app needs:
 *
 * - **iOS** gives a web view Dynamic Type only through the `-apple-system-body`
 *   font, which Ionic puts on <html>. So Ionic's own rem-sized components
 *   followed it, all the way to 53px at the largest accessibility size, and
 *   everything sized in px - the day card, the month table - stayed put.
 * - **Android**'s WebView applies the font scale itself, as text zoom, to
 *   every font size on the page, px included, with no cap. MainActivity turns
 *   that off (textZoom 100) and the scale comes from `TextSize.getFontScale`
 *   instead, so it is applied once, here, the same way as on iOS.
 * - **The web** has the browser's own font size, which `medium` resolves to.
 *
 * Whichever it is, the answer becomes `--text-scale` on <html>, capped, and
 * Ionic's root font is set from it, so rem and `calc(Npx * var(--text-scale))`
 * grow together. The layouts that cannot simply grow - six times across one
 * card, seven columns of a month - measure whether they still fit rather than
 * reading this number (see useFits).
 */

import { useSyncExternalStore } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

/** Larger than this, text stops growing: 2 is Android's own largest. */
export const MAX_TEXT_SCALE = 2;

/**
 * From this scale up, the layouts that cannot simply grow are laid out for
 * large text: `text-large` on <html>. iOS's first size past the default
 * (xxxL) is 1.35, Android's third step 1.3.
 */
export const LARGE_TEXT_SCALE = 1.3;

/** Smaller than this, text stops shrinking. iOS's smallest is about 0.82. */
export const MIN_TEXT_SCALE = 0.8;

/**
 * The root font size at a scale of 1. 17px on iOS, which is what
 * `-apple-system-body` is at the default size and what Ionic's iOS styles were
 * drawn against; 16px everywhere else, the browser's own default.
 */
export function baseFontSize(platform: string): number {
  return platform === "ios" ? 17 : 16;
}

/** A system scale brought into the range the layouts are built for. */
export function clampTextScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, scale));
}

/**
 * The root font size, in px, at `scale`. Rounded to a hundredth of a pixel so
 * the same scale always writes the same value.
 */
export function rootFontSize(scale: number, platform: string): number {
  return Math.round(baseFontSize(platform) * scale * 100) / 100;
}

/**
 * The value for Ionic's `--ion-dynamic-font`, which typography.css puts on
 * <html> as its `font` shorthand.
 */
export function rootFont(scale: number, platform: string): string {
  return `${rootFontSize(scale, platform)}px var(--ion-font-family)`;
}

type TextSizePlugin = {
  getFontScale(): Promise<{ fontScale: number }>;
};

const TextSize = registerPlugin<TextSizePlugin>("TextSize");

/**
 * The size, in px, of text in `font`, as this engine resolves it: on iOS
 * `-apple-system-body` is Dynamic Type's body size, and on the web `medium` is
 * the browser's font size setting.
 */
function probeFontSize(font: string): number | null {
  if (typeof document === "undefined" || document.body == null) return null;
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = `position:absolute;visibility:hidden;font:${font}`;
  document.body.appendChild(probe);
  const size = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  return Number.isFinite(size) && size > 0 ? size : null;
}

/** The system's text scale, before clamping: 1 is the default size. */
export async function readSystemTextScale(): Promise<number> {
  const platform = Capacitor.getPlatform();
  if (platform === "android") {
    try {
      const { fontScale } = await TextSize.getFontScale();
      return fontScale;
    } catch {
      // An older native shell without the plugin: its WebView is still
      // zooming text itself, so the page must not scale it again.
      return 1;
    }
  }
  const font = platform === "ios" ? "-apple-system-body" : "medium sans-serif";
  const size = probeFontSize(font);
  return size == null ? 1 : size / baseFontSize(platform);
}

let large = false;
const largeListeners = new Set<() => void>();

/**
 * Whether text is at a large size now (LARGE_TEXT_SCALE), for the controls
 * that lay themselves out in props rather than CSS - a select's label goes
 * above its value rather than beside it. Kept current as the size changes.
 */
export function useLargeText(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      largeListeners.add(onChange);
      return () => largeListeners.delete(onChange);
    },
    () => large,
    () => false
  );
}

/** Writes a scale onto <html>; returns the clamped value it used. */
export function applyTextScale(
  systemScale: number,
  platform: string = Capacitor.getPlatform(),
  root: HTMLElement = document.documentElement
): number {
  const scale = clampTextScale(systemScale);
  root.style.setProperty("--text-scale", String(scale));
  root.style.setProperty("--ion-dynamic-font", rootFont(scale, platform));
  // And the size itself, inline. Android's WebView (Chrome 133 on the
  // emulator) drops typography.css's `font: var(--ion-dynamic-font, ...)`
  // rule altogether, which left every rem at 16px - Ionic's own titles and
  // labels did not grow while the app's did.
  root.style.fontSize = `${rootFontSize(scale, platform)}px`;
  const isLarge = scale >= LARGE_TEXT_SCALE;
  root.classList.toggle("text-large", isLarge);
  if (root === document.documentElement && isLarge !== large) {
    large = isLarge;
    largeListeners.forEach((listener) => listener());
  }
  return scale;
}

/**
 * Reads the system's text size and applies it, now and whenever the app comes
 * back to the front - where a change made in Settings is first seen. On
 * Android a change of font scale restarts the activity anyway; on iOS the
 * web view keeps running and only re-resolves `-apple-system-body`.
 */
export function followSystemTextScale(): () => void {
  let cancelled = false;
  const update = async () => {
    const scale = await readSystemTextScale();
    if (!cancelled) applyTextScale(scale);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") void update();
  };
  void update();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    cancelled = true;
    document.removeEventListener("visibilitychange", onVisible);
  };
}
