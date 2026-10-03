import Capacitor

/**
 * The app's one screen. Exists only to register the plugins that live in
 * the app rather than in a package - Capacitor's generated plugin list knows
 * nothing about those. Main.storyboard names this class.
 */
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PrayerWidgetPlugin())
    }
}
