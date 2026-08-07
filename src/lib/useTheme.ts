import { useEffect, useLayoutEffect, useState } from "react";
import { Prayer } from "./PrayerTimes";
import {
  DARK_PALETTE_CLASS,
  Theme,
  isDark,
  systemPrefersDark,
} from "./theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The device's light/dark setting, kept current rather than read once. */
function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (query == null) {
      return;
    }
    // Re-read on subscribe: the setting can change between first render and
    // this effect, and that change would otherwise never arrive.
    setPrefersDark(query.matches);

    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersDark(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return prefersDark;
}

/**
 * Applies the chosen theme to the document. Sole owner of the palette class -
 * nothing else should add or remove it.
 */
export function useTheme(theme: Theme, nextPrayer: Prayer | null): void {
  const prefersDark = useSystemPrefersDark();
  const dark = isDark(theme, { prefersDark, nextPrayer });

  // Layout effect so the palette is in place before the browser paints,
  // rather than flashing the wrong one for a frame.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle(DARK_PALETTE_CLASS, dark);
  }, [dark]);
}
