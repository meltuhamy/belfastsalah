import SwiftUI
import WidgetKit
import XCTest

/**
 * What the widget tests share: the payload fixtures, the moments they are
 * looked at, and the sizes iOS draws each family at.
 *
 * The fixtures are the JSON files in fixtures/widget-payload at the root,
 * written by the real buildWidgetPayload (src/lib/widgetPayload.fixture.test.ts)
 * and copied into this bundle as a folder. 15 January in London, on GMT, so
 * the clock strings are the UTC ones - the same day as Android's
 * PayloadFixture, and not 15 February, which the gallery's sample entry uses.
 */
enum Fixture {
    static let names = ["Fajr", "Shuruq", "Duhr", "Asr", "Maghrib", "Isha"]
    static let times = ["06:20", "07:57", "12:15", "14:01", "16:23", "18:00"]
    static let tomorrowTimes = ["06:19", "07:56", "12:15", "14:03", "16:25", "18:02"]
    static let date = "Thu 15 Jan"
    static let tomorrowDate = "Fri 16 Jan"

    static func json(_ name: String) -> String {
        let bundle = Bundle(for: BundleToken.self)
        guard let url = bundle.url(forResource: name, withExtension: "json", subdirectory: "widget-payload"),
              let text = try? String(contentsOf: url, encoding: .utf8)
        else {
            fatalError("Missing fixture \(name).json - is fixtures/widget-payload in the test bundle?")
        }
        return text
    }

    static func payload(_ name: String = "london-2026-01-15") -> WidgetPayload {
        guard let payload = WidgetPayload.parse(json(name)) else {
            fatalError("\(name).json did not parse - has the payload version moved on?")
        }
        return payload
    }

    /** "HH:mm" on the 15th, in London - which in January is UTC. */
    static func on15th(_ clock: String, seconds: TimeInterval = 0) -> Date {
        let parts = clock.split(separator: ":").compactMap { Double($0) }
        return Date(timeIntervalSince1970: 1_768_435_200 + parts[0] * 3600 + parts[1] * 60 + seconds)
    }

    /**
     * Half a second before the minute, as on Android: a timer truncates, and
     * it reads the clock when drawn - aim at the second exactly and the text
     * flickers between runs.
     */
    static let onePM = on15th("13:00", seconds: -0.5) // Asr next, 1:01:00 away
    static let threePM = on15th("15:00", seconds: -0.5) // Maghrib: the longest name
    static let afterIsha = on15th("18:01", seconds: -0.5) // tomorrow's Fajr

    /** The first entry at `now`, for drawing. */
    static func entry(
        at now: Date = onePM,
        settings: WidgetSettings = WidgetSettings(),
        payload: String = "london-2026-01-15"
    ) -> PrayerEntry {
        PrayerTimeline.build(payload: Fixture.payload(payload), now: now, settings: settings).entries[0]
    }
}

private final class BundleToken {}

/** A phone's widget sizes, in points, as iOS lays them out. */
struct DeviceSizes {
    let name: String
    let sizes: [WidgetFamily: CGSize]

    /** The 6.9" phones, whose screenshots the App Store asks for. */
    static let proMax = DeviceSizes(name: "pro-max", sizes: [
        .systemSmall: CGSize(width: 170, height: 170),
        .systemMedium: CGSize(width: 364, height: 170),
        .systemLarge: CGSize(width: 364, height: 382),
        .accessoryRectangular: CGSize(width: 172, height: 76),
        .accessoryCircular: CGSize(width: 76, height: 76),
        .accessoryInline: CGSize(width: 257, height: 26),
    ])

    /** The smallest phone iOS 17 still runs on, where text is tightest. */
    static let se = DeviceSizes(name: "se", sizes: [
        .systemSmall: CGSize(width: 148, height: 148),
        .systemMedium: CGSize(width: 321, height: 148),
        .systemLarge: CGSize(width: 321, height: 324),
        .accessoryRectangular: CGSize(width: 153, height: 68),
        .accessoryCircular: CGSize(width: 68, height: 68),
        .accessoryInline: CGSize(width: 234, height: 26),
    ])

    static let all = [proMax, se]
}

extension WidgetFamily {
    static let home: [WidgetFamily] = [.systemSmall, .systemMedium, .systemLarge]
    static let lockScreen: [WidgetFamily] = [.accessoryRectangular, .accessoryCircular, .accessoryInline]

    var isAccessory: Bool { WidgetFamily.lockScreen.contains(self) }

    var slug: String {
        switch self {
        case .systemSmall: return "small"
        case .systemMedium: return "medium"
        case .systemLarge: return "large"
        case .accessoryRectangular: return "rectangular"
        case .accessoryCircular: return "circular"
        case .accessoryInline: return "inline"
        default: return "other"
        }
    }
}

/**
 * The widget as close to how a phone draws it as a test can get without
 * WidgetKit: its content inside the system's 16-point margins, on its
 * background, with the home screen's rounded corners. Lock screen widgets go
 * on a dark backdrop with no margins, as they sit on a wallpaper.
 */
struct WidgetFrame: View {
    let entry: PrayerEntry
    let family: WidgetFamily
    let scheme: ColorScheme
    var probing = false

    var body: some View {
        let colors = WidgetColors(settings: entry.settings, systemScheme: scheme)
        Group {
            if family.isAccessory {
                PrayerWidgetContent(entry: entry, family: family, colors: colors)
                    .foregroundStyle(.white)
                    .background(Color(white: 0.18))
            } else {
                PrayerWidgetContent(entry: entry, family: family, colors: colors)
                    .padding(16)
                    .background(colors.background)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
        }
        .environment(\.fitProbing, probing)
        .environment(\.colorScheme, family.isAccessory ? .dark : scheme)
    }
}

/**
 * The entry with its countdown target moved to the same distance from the
 * real clock as from the entry's own moment. The timer text reads the real
 * clock when drawn, so without this a snapshot of 15 January would show a
 * countdown from today.
 */
func rebasedToNow(_ entry: PrayerEntry) -> PrayerEntry {
    guard case .times(let times) = entry.content else { return entry }
    let now = Date()
    let target = now.addingTimeInterval(times.nextAt.timeIntervalSince(entry.date))
    return PrayerEntry(
        date: now,
        settings: entry.settings,
        content: .times(PrayerEntry.Times(
            location: times.location,
            dateLabel: times.dateLabel,
            prayers: times.prayers,
            nextIndex: times.nextIndex,
            nextName: times.nextName,
            nextTime: times.nextTime,
            nextAt: target,
            minutesLeft: times.minutesLeft
        ))
    )
}
