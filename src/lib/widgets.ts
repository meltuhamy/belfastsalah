import { Capacitor, registerPlugin } from "@capacitor/core";
import { AppSettings } from "./settings";
import { buildWidgetPayload } from "./widgetPayload";

type PrayerWidgetPlugin = {
  update(options: { payload: string }): Promise<void>;
  openSettings(): Promise<void>;
  // Battery optimisation. Android only; the settings screen never calls
  // these anywhere else. They live on this plugin because it is the app's
  // own, and LocalNotifications (which reports exact alarms) has no battery
  // call to reuse.
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  openBatteryOptimizationSettings(): Promise<void>;
};

const PrayerWidget = registerPlugin<PrayerWidgetPlugin>("PrayerWidget");

/**
 * Whether Android is applying battery restrictions to this app.
 *
 * True means restricted (the usual case). The settings row uses that to
 * decide whether to show, and hides once the user has allowed the app.
 */
export async function isBatteryRestricted(): Promise<boolean> {
  const { ignoring } = await PrayerWidget.isIgnoringBatteryOptimizations();
  return !ignoring;
}

/** Opens the battery-optimisation list. No permission, and no result. */
export async function openBatteryOptimizationSettings(): Promise<void> {
  await PrayerWidget.openBatteryOptimizationSettings();
}

/**
 * Hands the home screen widgets a fresh payload.
 *
 * Never throws. A widget that fails to update is a widget showing slightly old
 * times; an exception here would take the screen that called it down with it,
 * which is a far worse trade.
 */
export async function refreshWidgets(
  settings: AppSettings | null,
  now: Date = new Date()
): Promise<void> {
  // No widgets on the web, and registerPlugin's proxy rejects there.
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const payload = await buildWidgetPayload(settings, now);
    if (payload === null) {
      return;
    }
    await PrayerWidget.update({ payload: JSON.stringify(payload) });
  } catch (error) {
    console.warn("Could not update the prayer widgets", error);
  }
}

/**
 * How this platform lets people change a widget's look, which decides what
 * the settings screen offers.
 *
 * - "screen": Android. The app can open the appearance screen itself, and
 *   has to, because launchers differ on whether they reopen it.
 * - "edit-widget": iOS. Only the home screen can - long-press, Edit Widget -
 *   so the app can only say where to look.
 * - null: no widgets, as on the web.
 */
export type WidgetSettingsRoute = "screen" | "edit-widget" | null;

export function widgetSettingsRoute(): WidgetSettingsRoute {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  switch (Capacitor.getPlatform()) {
    case "android":
      return "screen";
    case "ios":
      return "edit-widget";
    default:
      return null;
  }
}

/**
 * Opens the appearance settings for a placed widget.
 *
 * Android only offers the configuration screen when a widget is added, and
 * whether a launcher lets you reopen it afterwards is up to the launcher -
 * the Pixel launcher does not. This is the way back in.
 */
export async function openWidgetSettings(): Promise<void> {
  if (widgetSettingsRoute() !== "screen") {
    return;
  }
  try {
    await PrayerWidget.openSettings();
  } catch (error) {
    console.warn("Could not open the widget settings", error);
  }
}
