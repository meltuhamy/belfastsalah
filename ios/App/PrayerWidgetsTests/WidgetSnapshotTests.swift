import SnapshotTesting
import SwiftUI
import WidgetKit
import XCTest

/**
 * Each widget's pixels, compared with the references in __Snapshots__.
 *
 * The references have to come from the CI runner: push with
 * "[record screenshots]" in the commit message and the record workflow
 * re-records them there and commits them back. Another machine, or another
 * Xcode, draws text a pixel differently and every comparison would fail.
 *
 * Drawn at the 6.9" phone's sizes. WidgetFitTests covers the smaller ones.
 */
final class WidgetSnapshotTests: XCTestCase {

    private func snapshot(
        _ entry: PrayerEntry,
        _ family: WidgetFamily,
        _ scheme: ColorScheme = .light,
        named name: String,
        file: StaticString = #filePath,
        testName: String = #function,
        line: UInt = #line
    ) {
        let size = DeviceSizes.proMax.sizes[family]!
        assertSnapshot(
            of: WidgetFrame(entry: rebasedToNow(entry), family: family, scheme: scheme),
            as: .image(
                precision: 0.995,
                perceptualPrecision: 0.98,
                layout: .fixed(width: size.width, height: size.height),
                traits: UITraitCollection(userInterfaceStyle: scheme == .dark ? .dark : .light)
            ),
            named: name,
            file: file,
            testName: testName,
            line: line
        )
    }

    func testHomeScreen() {
        for family in WidgetFamily.home {
            snapshot(Fixture.entry(), family, .light, named: "\(family.slug)-light")
            snapshot(Fixture.entry(), family, .dark, named: "\(family.slug)-dark")
        }
    }

    func testLockScreen() {
        for family in WidgetFamily.lockScreen {
            snapshot(Fixture.entry(settings: WidgetSettings(accent: nil, showDate: false)),
                     family, named: family.slug)
        }
    }

    func testCountdownModes() {
        for mode in WidgetSettings.Countdown.allCases {
            let entry = Fixture.entry(settings: WidgetSettings(countdown: mode))
            snapshot(entry, .systemSmall, named: "small-\(mode.rawValue)")
            snapshot(entry, .accessoryRectangular, named: "rectangular-\(mode.rawValue)")
        }
    }

    func testHighlightsAndPalettes() {
        for accent in WidgetSettings.Accent.allCases {
            snapshot(Fixture.entry(settings: WidgetSettings(accent: accent)),
                     .systemMedium, named: "medium-\(accent.rawValue)")
        }
        snapshot(Fixture.entry(settings: WidgetSettings(accent: nil)),
                 .systemMedium, named: "medium-no-highlight")
        // Chosen palettes win over the phone's appearance.
        snapshot(Fixture.entry(settings: WidgetSettings(palette: .dark)),
                 .systemMedium, .light, named: "medium-dark-on-light-phone")
        snapshot(Fixture.entry(settings: WidgetSettings(palette: .light)),
                 .systemMedium, .dark, named: "medium-light-on-dark-phone")
    }

    func testWithoutCityOrDate() {
        let entry = Fixture.entry(settings: WidgetSettings(showLocation: false, showDate: false))
        snapshot(entry, .systemSmall, named: "small")
        snapshot(entry, .systemMedium, named: "medium")
    }

    func testAfterIsha() {
        snapshot(Fixture.entry(at: Fixture.afterIsha), .systemLarge, named: "large")
    }

    func testNoTimes() {
        let empty = PrayerEntry(date: Date(), settings: WidgetSettings(), content: .empty)
        snapshot(empty, .systemSmall, named: "small")
        snapshot(empty, .accessoryRectangular, named: "rectangular")
    }
}
