import { Capacitor } from "@capacitor/core";
import { widgetSettingsRoute } from "./widgets";

// Which settings row a platform gets. The rows themselves are plain markup;
// what matters is that iOS, where the app cannot open a widget's settings,
// is never offered a row that does nothing when tapped.

describe("widgetSettingsRoute", () => {
  afterEach(() => vi.restoreAllMocks());

  function on(platform: string) {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(platform !== "web");
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue(platform);
  }

  it("opens the appearance screen on Android", () => {
    on("android");
    expect(widgetSettingsRoute()).toBe("screen");
  });

  it("points at Edit Widget on iOS", () => {
    on("ios");
    expect(widgetSettingsRoute()).toBe("edit-widget");
  });

  it("offers nothing on the web", () => {
    on("web");
    expect(widgetSettingsRoute()).toBeNull();
  });
});
