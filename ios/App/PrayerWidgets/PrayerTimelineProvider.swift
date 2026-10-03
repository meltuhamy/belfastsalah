import WidgetKit

/** Hands WidgetKit the entries PrayerTimeline builds from the stored payload. */
struct PrayerTimelineProvider<Intent: SettingsIntent>: AppIntentTimelineProvider {
    typealias Entry = PrayerEntry

    func placeholder(in context: Context) -> PrayerEntry {
        .sample()
    }

    func snapshot(for configuration: Intent, in context: Context) async -> PrayerEntry {
        // The gallery shows a preview before anything has been set up.
        if context.isPreview {
            return .sample(settings: configuration.settings)
        }
        return build(configuration).entries.first ?? .sample(settings: configuration.settings)
    }

    func timeline(for configuration: Intent, in context: Context) async -> Timeline<PrayerEntry> {
        let (entries, reload) = build(configuration)
        return Timeline(entries: entries, policy: reload == .atEnd ? .atEnd : .never)
    }

    private func build(_ configuration: Intent) -> (entries: [PrayerEntry], reload: PrayerTimeline.Reload) {
        PrayerTimeline.build(
            payload: WidgetPayload.parse(WidgetStore.shared?.read()),
            now: Date(),
            settings: configuration.settings
        )
    }
}
