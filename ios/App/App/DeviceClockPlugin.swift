import Capacitor
import UIKit

/**
 * The phone's own 12/24-hour switch.
 *
 * `DateFormatter` with the "j" template is what resolves it: iOS rewrites the
 * skeleton according to the region and the 24-Hour Time switch, leaving an
 * "a" (AM/PM) in the pattern exactly when the clock is a 12-hour one.
 *
 * The switch can be changed in Settings while the app is open, so the plugin
 * listens for the app becoming active and for a locale change, and only then
 * tells the web layer. Registered by MainViewController, like the widget
 * plugin: plugins inside the app are not in Capacitor's generated list.
 */
@objc(DeviceClockPlugin)
public class DeviceClockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DeviceClockPlugin"
    public let jsName = "DeviceClock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getFormat", returnType: CAPPluginReturnPromise),
    ]

    private var observers: [NSObjectProtocol] = []
    private var lastUses24Hour: Bool?

    override public func load() {
        lastUses24Hour = Self.uses24Hour()
        let center = NotificationCenter.default
        observers.append(center.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.publish()
        })
        observers.append(center.addObserver(
            forName: NSLocale.currentLocaleDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.publish()
        })
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
    }

    @objc func getFormat(_ call: CAPPluginCall) {
        call.resolve(["uses24Hour": Self.uses24Hour()])
    }

    static func uses24Hour() -> Bool {
        let pattern = DateFormatter.dateFormat(
            fromTemplate: "j",
            options: 0,
            locale: Locale.current
        ) ?? ""
        return !pattern.contains("a")
    }

    private func publish() {
        let current = Self.uses24Hour()
        if current == lastUses24Hour {
            return
        }
        lastUses24Hour = current
        notifyListeners("timeFormatChanged", data: ["uses24Hour": current])
    }
}
