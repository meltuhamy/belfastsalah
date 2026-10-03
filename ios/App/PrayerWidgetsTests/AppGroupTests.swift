import UIKit
import XCTest

/**
 * The App Group, from inside the app - this bundle is hosted by it - which
 * is the side that writes. If the entitlement is missing from a build, the
 * widget extension can never see what the app wrote, and nothing else would
 * say so: the widgets would just ask to be opened, forever.
 */
final class AppGroupTests: XCTestCase {

    /**
     * The controller the app launches into is the one that registers the
     * widget plugin. It once was Capacitor's own, created by SceneDelegate,
     * and nothing failed: the web layer's updates were rejected quietly and
     * every placed widget said "No times".
     */
    func testTheAppLaunchesIntoTheControllerThatRegistersThePlugin() throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let root = try XCTUnwrap(scene.windows.first { $0.isKeyWindow }?.rootViewController
            ?? scene.windows.first?.rootViewController)
        XCTAssertEqual(NSStringFromClass(type(of: root)), "App.MainViewController")
    }

    func testTheAppIsEntitledToTheGroup() {
        XCTAssertNotNil(
            FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: WidgetStore.appGroup),
            "the app is missing the \(WidgetStore.appGroup) entitlement"
        )
    }

    func testWhatIsWrittenCanBeReadBackThroughTheGroup() throws {
        let store = try XCTUnwrap(WidgetStore.shared)
        let json = Fixture.json("london-2026-01-15")
        store.write(json)

        // A fresh handle on the suite, as the extension would open it.
        let reader = WidgetStore(defaults: try XCTUnwrap(UserDefaults(suiteName: WidgetStore.appGroup)))
        XCTAssertEqual(WidgetPayload.parse(reader.read()), Fixture.payload())
    }
}
