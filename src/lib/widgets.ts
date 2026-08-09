import { Capacitor, registerPlugin } from "@capacitor/core";
import { AppSettings } from "./settings";
import { buildWidgetPayload } from "./widgetPayload";

type PrayerWidgetPlugin = {
  update(options: { payload: string }): Promise<void>;
};

const PrayerWidget = registerPlugin<PrayerWidgetPlugin>("PrayerWidget");

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
