import { createContext, useEffect, useContext } from "react";
import { getSettings, saveSettings, AppSettings, SaveOptions } from "./settings";
import { AppContext } from "../State";

type MaybeAppSettings = AppSettings | null;
let latestSettings: MaybeAppSettings = null;

type UseSettingsHookResult = [
  MaybeAppSettings,
  (appSettings: AppSettings, options?: SaveOptions) => Promise<void>,
  boolean
];

/**
 * Settings that stand in for the stored ones below it, read-only: the day
 * card preview (DayCardPreviewPage) shows the card for another place or
 * theme without saving anything, or touching reminders or widgets. Null
 * everywhere else.
 */
export const SettingsOverride = createContext<AppSettings | null>(null);

export function useSettings(): UseSettingsHookResult {
  const { state, dispatch } = useContext(AppContext);
  const override = useContext(SettingsOverride);
  const storageValue = state.settings.value;
  const hydrated = state.settings.hydrated;

  useEffect(() => {
    getSettings().then(settingsValue => {
      latestSettings = settingsValue;
      dispatch({
        type: "setSettings",
        payload: { hydrated: true, value: latestSettings }
      });
    });
  }, []);

  async function setNewSettings(appSettings: AppSettings, options?: SaveOptions) {
    latestSettings = appSettings;
    dispatch({
      type: "setSettings",
      payload: {
        hydrated: true,
        value: latestSettings
      }
    });

    await saveSettings(latestSettings, options); // optimistic
  }

  if (override != null) {
    return [override, async () => {}, true];
  }
  return [storageValue, setNewSettings, hydrated];
}
