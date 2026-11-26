/**
 * Keeps the screen on while the app is open, when the `keepAwake` setting
 * asks for it (MEL-356).
 *
 * On a phone it is the native plugin, KeepAwakePlugin.kt and
 * KeepAwakePlugin.swift: Android's FLAG_KEEP_SCREEN_ON on the activity's
 * window, iOS's idle timer. Both only ever hold while the app is in front -
 * the system lets the screen sleep as usual once it is not - and both
 * re-apply themselves when the app comes back, so this module only has to say
 * what is wanted when it changes.
 *
 * The web has the Screen Wake Lock API instead, which the browser drops
 * whenever the page is hidden. So on the web the lock is asked for again each
 * time the page is shown, for as long as it is wanted. A browser without the
 * API, or one that refuses, just leaves the screen to its usual timeout.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect } from "react";

type KeepAwakePlugin = {
  set(options: { keepAwake: boolean }): Promise<void>;
};

const KeepAwake = registerPlugin<KeepAwakePlugin>("KeepAwake");

type Sentinel = {
  released: boolean;
  release(): Promise<void>;
};

type WakeLockApi = {
  request(type: "screen"): Promise<Sentinel>;
};

function wakeLockApi(): WakeLockApi | null {
  const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
  return api ?? null;
}

let wanted = false;
let sentinel: Sentinel | null = null;
// One request at a time: a second while the first is pending would leave an
// extra lock behind that nothing releases.
let pending: Promise<void> | null = null;
let listening = false;

async function acquire(): Promise<void> {
  const api = wakeLockApi();
  if (api === null || document.visibilityState !== "visible") {
    return;
  }
  if (sentinel !== null && !sentinel.released) {
    return;
  }
  if (pending !== null) {
    return pending;
  }
  pending = (async () => {
    try {
      const lock = await api.request("screen");
      if (wanted) {
        sentinel = lock;
      } else {
        // Switched off while the request was in flight.
        await lock.release();
      }
    } catch (error) {
      // Refused (no user gesture yet, battery saver, a policy): nothing to do
      // but try again the next time the page is shown.
      console.warn("Could not keep the screen awake", error);
    } finally {
      pending = null;
    }
  })();
  return pending;
}

async function releaseWebLock(): Promise<void> {
  const lock = sentinel;
  sentinel = null;
  if (lock !== null && !lock.released) {
    try {
      await lock.release();
    } catch {
      // Already gone.
    }
  }
}

function onVisibilityChange() {
  if (wanted && document.visibilityState === "visible") {
    void acquire();
  }
}

/** Says whether the screen should stay on. Safe to call with the same value. */
export async function setKeepAwake(keepAwake: boolean): Promise<void> {
  wanted = keepAwake;
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.set({ keepAwake });
    } catch (error) {
      console.warn("Could not change whether the screen stays awake", error);
    }
    return;
  }
  if (wakeLockApi() === null) {
    return;
  }
  if (!listening) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    listening = true;
  }
  if (keepAwake) {
    await acquire();
  } else {
    await releaseWebLock();
  }
}

/** Keeps the screen awake for as long as `keepAwake` is true. */
export function useKeepAwake(keepAwake: boolean) {
  useEffect(() => {
    void setKeepAwake(keepAwake);
  }, [keepAwake]);
}

/** For tests: forgets everything, as a fresh page load would. */
export function resetKeepAwakeForTests() {
  if (listening) {
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }
  wanted = false;
  sentinel = null;
  pending = null;
  listening = false;
}
