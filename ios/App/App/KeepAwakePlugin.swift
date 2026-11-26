import Capacitor
import UIKit

/**
 * Keeps the screen on while the app is in front (MEL-356), for the
 * `keepAwake` setting: src/lib/keepAwake.ts says when it changes.
 *
 * Turning the idle timer off only ever holds while the app is active - iOS
 * lets the screen lock as usual once it is not - and needs no permission.
 * The plugin remembers what was asked and sets it again whenever the app
 * becomes active, since iOS does not promise to keep it across a trip to the
 * background. Registered by MainViewController, like the other plugins that
 * live in the app.
 */
@objc(KeepAwakePlugin)
public class KeepAwakePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KeepAwakePlugin"
    public let jsName = "KeepAwake"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
    ]

    private var keepAwake = false
    private var observer: NSObjectProtocol?

    override public func load() {
        observer = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.apply()
        }
    }

    deinit {
        if let observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        let on = call.getBool("keepAwake") ?? false
        DispatchQueue.main.async {
            self.keepAwake = on
            self.apply()
            call.resolve()
        }
    }

    private func apply() {
        UIApplication.shared.isIdleTimerDisabled = keepAwake
    }
}
