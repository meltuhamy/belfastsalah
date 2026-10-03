import Capacitor
import WidgetKit

/**
 * The web layer's only way in: hand over a payload and have the widgets
 * redraw. The same name and method as PrayerWidgetPlugin.kt, so
 * src/lib/widgets.ts does not know which platform it is on.
 *
 * Registered by MainViewController - plugins that live in the app itself are
 * not in Capacitor's generated list.
 */
@objc(PrayerWidgetPlugin)
public class PrayerWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrayerWidgetPlugin"
    public let jsName = "PrayerWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
    ]

    @objc func update(_ call: CAPPluginCall) {
        guard let payload = call.getString("payload") else {
            call.reject("payload is required")
            return
        }
        guard let store = WidgetStore.shared else {
            call.reject("the App Group is missing from this build")
            return
        }
        Self.apply(payload, to: store) { WidgetCenter.shared.reloadAllTimelines() }
        call.resolve()
    }

    /** What update does, apart from the bridge - so a test can call it. */
    static func apply(_ payload: String, to store: WidgetStore, reload: () -> Void) {
        store.write(payload)
        reload()
    }
}
