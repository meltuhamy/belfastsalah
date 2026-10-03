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
        let store = WidgetStore.shared
        let raw = store?.read()
        let payload = WidgetPayload.parse(raw)
        var (entries, reload) = PrayerTimeline.build(
            payload: payload, now: Date(), settings: configuration.settings
        )

        // Why the widget would be empty, for the log and Debug builds.
        let reason: String
        if store == nil {
            reason = "no App Group"
        } else if raw == nil {
            reason = "nothing written to the App Group yet"
        } else if payload == nil {
            reason = "a payload it cannot read (\(raw?.count ?? 0) bytes)"
        } else {
            reason = "the written times have run out"
        }
        if entries.first.map({ $0.content == .empty }) ?? true {
            NSLog("PrayerWidget: timeline is empty: %@", reason)
        } else {
            NSLog("PrayerWidget: timeline of %d entries", entries.count)
        }
        entries = entries.map { entry in
            guard entry.content == .empty else { return entry }
            var noted = entry
            noted.note = reason
            return noted
        }
        return (entries, reload)
    }
}
