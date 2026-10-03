import SwiftUI
import UIKit
import WidgetKit
import XCTest

/**
 * No text in any widget is cut off, at every size it is drawn at.
 *
 * The counterpart of Android's WidgetFitTest, and the check that matters
 * most: a shortened line is the bug widgets actually have, and it never shows
 * as an error. Each probed text (see FitProbe) reports the width it was given
 * and the width it needed, from real text layout on the simulator.
 *
 * The circular lock screen widget is left out: it is allowed to scale its
 * text down to fit, so a natural width larger than its room is by design.
 */
final class WidgetFitTests: XCTestCase {

    /** The cases most likely to run out of room. */
    private var entries: [(String, PrayerEntry)] {
        var cases: [(String, PrayerEntry)] = [
            ("asr", Fixture.entry()),
            // "Maghrib" is the longest name.
            ("maghrib", Fixture.entry(at: Fixture.threePM)),
            // Hours of countdown in the longest form it takes.
            ("after-isha", Fixture.entry(at: Fixture.afterIsha)),
            ("belfast", Fixture.entry(payload: "belfast-2026-01-15")),
        ]
        for mode in WidgetSettings.Countdown.allCases {
            cases.append(("maghrib-\(mode.rawValue)",
                          Fixture.entry(at: Fixture.threePM, settings: WidgetSettings(countdown: mode))))
        }
        cases.append(("no-highlight", Fixture.entry(at: Fixture.threePM, settings: WidgetSettings(accent: nil))))
        return cases.map { ($0.0, rebasedToNow($0.1)) }
    }

    func testNothingIsCutOff() {
        var failures: [String] = []
        let families = WidgetFamily.home + [.accessoryRectangular, .accessoryInline]
        for device in DeviceSizes.all {
            for family in families {
                for typeSize in [DynamicTypeSize.large, .xLarge] {
                    for (name, entry) in entries {
                        let size = device.sizes[family]!
                        for (id, m) in measure(entry, family, size, typeSize)
                        where m.natural > m.given + 0.5 {
                            failures.append(
                                "\(device.name) \(family.slug) \(typeSize) \(name): '\(id)' " +
                                "needs \(Int(m.natural.rounded(.up)))pt, has \(Int(m.given))pt"
                            )
                        }
                    }
                }
            }
        }
        XCTAssertTrue(failures.isEmpty, "Cut off:\n" + failures.joined(separator: "\n"))
    }

    /** The probe's readings for one widget, laid out in a real window. */
    private func measure(
        _ entry: PrayerEntry, _ family: WidgetFamily, _ size: CGSize, _ typeSize: DynamicTypeSize
    ) -> [String: FitMeasurement] {
        let box = Box()
        let view = WidgetFrame(entry: entry, family: family, scheme: .light, probing: true)
            .environment(\.dynamicTypeSize, typeSize)
            .frame(width: size.width, height: size.height)
            .onPreferenceChange(FitPreferenceKey.self) { box.values = $0 }

        layOut(view, size)
        return box.values
    }

    /**
     * Puts a view on screen in the host app's scene long enough for SwiftUI
     * to lay it out and report its preferences. A window outside any scene is
     * never shown, and an unshown hosting view does not always lay out.
     */
    private func layOut<V: View>(_ view: V, _ size: CGSize) {
        let controller = UIHostingController(rootView: view)
        let window: UIWindow
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            window = UIWindow(windowScene: scene)
            window.frame = CGRect(origin: .zero, size: size)
        } else {
            window = UIWindow(frame: CGRect(origin: .zero, size: size))
        }
        window.rootViewController = controller
        window.isHidden = false
        controller.view.frame = window.bounds
        controller.view.layoutIfNeeded()
        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        window.isHidden = true
    }

    private final class Box {
        var values: [String: FitMeasurement] = [:]
    }

    /** The probe itself: a line that cannot fit is reported as one. */
    func testTheProbeNoticesALongLine() {
        let box = Box()
        let view = Text(String(repeating: "Maghrib ", count: 20))
            .lineLimit(1)
            .fitProbe("long")
            .environment(\.fitProbing, true)
            .frame(width: 100, height: 40)
            .onPreferenceChange(FitPreferenceKey.self) { box.values = $0 }
        layOut(view, CGSize(width: 100, height: 40))

        let long = box.values["long"]
        XCTAssertNotNil(long)
        XCTAssertGreaterThan(long?.natural ?? 0, (long?.given ?? 0) + 100)
    }
}
