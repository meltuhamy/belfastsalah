import React, { useEffect, useRef, useState } from "react";
import { IonIcon, IonItem, IonLabel, IonListHeader, IonToast } from "@ionic/react";
import { bugOutline, informationCircleOutline, sunnyOutline } from "ionicons/icons";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { UNLOCK_HOLD_MS, UnlockGesture } from "../lib/debugUnlock";
import { setDebugMode, useDebugMode } from "../lib/debugMode";

/**
 * The app's version, as the store has it, and the commit it was built from.
 * The files say 0.0.0 on purpose (RELEASING.md): the real version is given to
 * the native build, and read back from it here. The web has none.
 */
function useVersion(): string {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // Through a promise, so a platform without it - or a test's stand-in -
    // only leaves the version unknown.
    Promise.resolve()
      .then(() => CapacitorApp.getInfo())
      .then((info) => setVersion(`${info.version} (${info.build})`))
      .catch(() => {});
  }, []);
  return `${version ?? "Web"} · ${__APP_COMMIT__}`;
}

/**
 * The Version row, last in settings. Seven taps on it, then a press held for
 * seven seconds, turns debug mode on (debugUnlock.ts); nothing on screen
 * says so until it has.
 */
export const VersionRow: React.FC = () => {
  const version = useVersion();
  const gesture = useRef(new UnlockGesture());
  const timer = useRef<number | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const debug = useDebugMode();

  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  return (
    <>
      <IonItem
        lines="none"
        data-testid="version-row"
        className="settings-list__version"
        onPointerDown={() => {
          gesture.current.down(performance.now());
          clear();
          timer.current = window.setTimeout(() => {
            timer.current = null;
            if (!gesture.current.unlocksAt(performance.now())) return;
            gesture.current.cancel();
            if (!debug) {
              void setDebugMode(true);
              setSaid("Debug mode is on");
            }
          }, UNLOCK_HOLD_MS + 20);
        }}
        onPointerUp={() => {
          clear();
          gesture.current.up(performance.now());
        }}
        onPointerCancel={() => {
          clear();
          gesture.current.cancel();
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <IonIcon icon={informationCircleOutline} slot="start" />
        <IonLabel>
          <h3>Version</h3>
          <p data-testid="version">{version}</p>
        </IonLabel>
      </IonItem>
      <IonToast
        isOpen={said !== null}
        onDidDismiss={() => setSaid(null)}
        message={said ?? ""}
        duration={2000}
      />
    </>
  );
};

/**
 * Debug mode's rows, under their own heading at the foot of settings: the
 * place for tools that are not for everyone. Each is its own screen under
 * /settings/debug.
 */
export const DebugSection: React.FC = () => {
  const debug = useDebugMode();
  if (!debug) return null;
  return (
    <>
      <IonListHeader data-testid="debug-section">
        <IonLabel>Debug</IonLabel>
      </IonListHeader>
      <IonItem routerLink="/settings/debug/day-card" detail={true} data-testid="debug-day-card">
        <IonIcon icon={sunnyOutline} slot="start" />
        <IonLabel>
          <h3>Day card preview</h3>
          <p>Any place, theme and moment, on a clock of its own</p>
        </IonLabel>
      </IonItem>
      <IonItem button detail={false} onClick={() => void setDebugMode(false)} data-testid="debug-off">
        <IonIcon icon={bugOutline} slot="start" />
        <IonLabel>
          <h3>Turn off debug mode</h3>
        </IonLabel>
      </IonItem>
    </>
  );
};
