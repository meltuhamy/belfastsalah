import { useState } from "react";

/**
 * Whether the system text size is large enough that a label and its value
 * cannot share a row.
 *
 * The root font size is what both platforms adjust - iOS through Dynamic
 * Type, Android through the WebView's font scale - so reading it once at
 * mount is enough. The app is relaunched for a new system size to take effect.
 */
export default function useLargeText(): boolean {
  const [large] = useState(
    () =>
      typeof document !== "undefined" &&
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) >
        22
  );
  return large;
}
