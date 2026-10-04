import Foundation

/**
 * Where the app leaves the payload for the widgets to read.
 *
 * The widget extension is a separate process, so the app's own storage is out
 * of its reach. An App Group is a container both are entitled to; its
 * UserDefaults suite is the iOS counterpart of WidgetStore.kt's
 * SharedPreferences file. Compiled into the app, the extension and the tests.
 *
 * Our own suite and key rather than @capacitor/preferences' storage, for the
 * same reason as on Android: that is the plugin's implementation detail.
 */
struct WidgetStore {
    static let appGroup = "group.com.meltuhamy.londonsalah"
    private static let key = "payload"

    let defaults: UserDefaults

    /** The real store. Nil only if the App Group is missing from the build. */
    static var shared: WidgetStore? {
        UserDefaults(suiteName: appGroup).map(WidgetStore.init(defaults:))
    }

    func write(_ payload: String) {
        defaults.set(payload, forKey: Self.key)
    }

    func read() -> String? {
        defaults.string(forKey: Self.key)
    }
}
