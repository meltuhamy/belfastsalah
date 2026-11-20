import AudioToolbox
import Capacitor

/**
 * The iOS half of PrayerRemindersPlugin.kt. Reminders on iOS are scheduled by
 * @capacitor/local-notifications, so all this side does is let the sound list
 * play the default sound, which has no file of its own to play in the page.
 *
 * iOS does not let an app play the alert tone the user picked in Settings,
 * so this is the system's standard notification tone. Registered by
 * MainViewController, like the other plugins in the app.
 */
@objc(PrayerRemindersPlugin)
public class PrayerRemindersPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrayerRemindersPlugin"
    public let jsName = "PrayerReminders"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "playDefaultSound", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopDefaultSound", returnType: CAPPluginReturnPromise),
    ]

    /** "Tri-tone", the notification sound a new iPhone has. */
    private static let defaultAlertSound: SystemSoundID = 1007

    @objc func playDefaultSound(_ call: CAPPluginCall) {
        AudioServicesPlayAlertSound(Self.defaultAlertSound)
        call.resolve()
    }

    /** A system sound is too short to stop; there is nothing to do. */
    @objc func stopDefaultSound(_ call: CAPPluginCall) {
        call.resolve()
    }
}
