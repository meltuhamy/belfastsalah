import { useEffect, useContext } from "react";
import { getSettings, saveSettings, AppSettings } from "./settings";
import { AppContext } from "../State";

type MaybeAppSettings = AppSettings | null;
let latestSettings: MaybeAppSettings = null;

type UseSettingsHookResult = [
  MaybeAppSettings,
  (appSettings: AppSettings) => Promise<void>,
  boolean
];

export function useSettings(): UseSettingsHookResult {
  const { state, dispatch } = useContext(AppContext);
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

  async function setNewSettings(appSettings: AppSettings) {
    latestSettings = appSettings;
    dispatch({
      type: "setSettings",
      payload: {
        hydrated: true,
        value: latestSettings
      }
    });

    await saveSettings(latestSettings); // optimistic
  }

  return [storageValue, setNewSettings, hydrated];
}
