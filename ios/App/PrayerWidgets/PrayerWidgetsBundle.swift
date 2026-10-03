import SwiftUI
import WidgetKit

@main
struct PrayerWidgetsBundle: WidgetBundle {
    var body: some Widget {
        HomeScreenWidget()
        LockScreenWidget()
    }
}

/** Small, medium and large: the next prayer, or the day's six under it. */
struct HomeScreenWidget: Widget {
    static let kind = "PrayerTimes"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: Self.kind,
            intent: HomeScreenWidgetIntent.self,
            provider: PrayerTimelineProvider<HomeScreenWidgetIntent>()
        ) { entry in
            PrayerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Prayer times")
        .description("The next prayer and how long until it, with the day's times on the larger sizes.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

/** Beside the clock: the next prayer, in three shapes. */
struct LockScreenWidget: Widget {
    static let kind = "NextPrayer"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: Self.kind,
            intent: LockScreenWidgetIntent.self,
            provider: PrayerTimelineProvider<LockScreenWidgetIntent>()
        ) { entry in
            PrayerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Next prayer")
        .description("The next prayer and how long until it.")
        .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}
