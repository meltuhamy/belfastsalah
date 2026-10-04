import Capacitor

/**
 * The app's one screen. Exists only to register the plugins that live in
 * the app rather than in a package - Capacitor's generated plugin list knows
 * nothing about those.
 *
 * SceneDelegate creates it; the storyboard names it too, but is not what
 * the app launches from. Until SceneDelegate did, the plugin was never
 * registered, every update from the web layer failed quietly, and placed
 * widgets said "No times" - AppGroupTests now checks this is the root.
 */
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PrayerWidgetPlugin())
        NSLog("PrayerWidget: plugin registered")
    }
}
