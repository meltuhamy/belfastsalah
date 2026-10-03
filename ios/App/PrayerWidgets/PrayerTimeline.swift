import Foundation
import WidgetKit

/**
 * One moment of a widget: what it shows from `date` until the next entry.
 *
 * Plain data, so the views can be drawn - and tested - from an entry made by
 * hand, without WidgetKit running anything.
 */
struct PrayerEntry: TimelineEntry {
    let date: Date
    let settings: WidgetSettings
    let content: Content

    enum Content: Equatable {
        case times(Times)
        /** Nothing usable: no payload yet, an old one, or it has run out. */
        case empty
    }

    struct Times: Equatable {
        let location: String
        /** The day of the next prayer, e.g. "Thu 15 Jan". */
        let dateLabel: String
        /** That day's six, as display strings. */
        let prayers: [WidgetPrayer]
        /** Which of `prayers` is next; nil if its name is not among them. */
        let nextIndex: Int?
        let nextName: String
        let nextTime: String
        /** What the seconds countdown counts down to. */
        let nextAt: Date
        /**
         * Whole minutes left, rounded up, for the minutes countdown. Fixed per
         * entry - that countdown is redrawn by having an entry every minute.
         */
        let minutesLeft: Int
    }
}

/**
 * Turns the payload into timeline entries.
 *
 * WidgetKit draws each entry when its date arrives, whether or not anything
 * of ours is running, and asking for a fresh timeline is rationed. So rather
 * than an alarm per prayer, as on Android, the widget gets one entry per
 * prayer boundary - the payload already lists them all as `upcoming` - and
 * the system's own timer text does the ticking in between.
 *
 * The minutes countdown is the exception. iOS has no live text style that
 * leaves out seconds, so in that mode there is an entry for every minute,
 * each with its own fixed text. A timeline is capped at `maxEntries` and asks
 * for the next one when it runs out, which is a few reloads a day even then.
 */
enum PrayerTimeline {

    enum Reload: Equatable {
        /** Ask again once the last entry's moment arrives. */
        case atEnd
        /** Nothing more to come until the app writes a new payload. */
        case never
    }

    static let maxEntries = 60
    static let maxMinuteEntries = 180

    static func build(
        payload: WidgetPayload?,
        now: Date,
        settings: WidgetSettings
    ) -> (entries: [PrayerEntry], reload: Reload) {
        guard let payload,
              let first = payload.upcoming.firstIndex(where: { $0.date > now })
        else {
            return ([PrayerEntry(date: now, settings: settings, content: .empty)], .never)
        }

        let limit = settings.countdown == .minutes ? maxMinuteEntries : maxEntries
        var entries: [PrayerEntry] = []
        var start = now

        for upcoming in payload.upcoming[first...] {
            guard payload.days.indices.contains(upcoming.day) else { break }
            let day = payload.days[upcoming.day]

            if settings.countdown == .minutes {
                var moment = start
                while moment < upcoming.date {
                    let left = minutesLeft(from: moment, to: upcoming.date)
                    entries.append(entry(moment, settings, payload, day, upcoming, left))
                    if entries.count >= limit { return (entries, .atEnd) }
                    // The instant the rounded-up count drops by one.
                    moment = upcoming.date.addingTimeInterval(-Double(left - 1) * 60)
                }
            } else {
                let left = minutesLeft(from: start, to: upcoming.date)
                entries.append(entry(start, settings, payload, day, upcoming, left))
                if entries.count >= limit { return (entries, .atEnd) }
            }
            start = upcoming.date
        }

        // Past the last prayer the app wrote: ask to be opened.
        entries.append(PrayerEntry(date: start, settings: settings, content: .empty))
        return (entries, .never)
    }

    static func minutesLeft(from moment: Date, to target: Date) -> Int {
        max(1, Int((target.timeIntervalSince(moment) / 60).rounded(.up)))
    }

    private static func entry(
        _ date: Date,
        _ settings: WidgetSettings,
        _ payload: WidgetPayload,
        _ day: WidgetDay,
        _ next: WidgetUpcoming,
        _ minutesLeft: Int
    ) -> PrayerEntry {
        PrayerEntry(
            date: date,
            settings: settings,
            content: .times(PrayerEntry.Times(
                location: payload.locationLabel,
                dateLabel: day.dateLabel,
                prayers: day.prayers,
                nextIndex: day.prayers.firstIndex { $0.name == next.name },
                nextName: next.name,
                nextTime: next.time,
                nextAt: next.date,
                minutesLeft: minutesLeft
            ))
        )
    }
}

extension PrayerEntry {
    /**
     * What the widget gallery and placeholders show: 15 February in London,
     * Duhr next. Tests use 15 January, so none can pass on these by accident.
     */
    static func sample(settings: WidgetSettings = WidgetSettings(), date: Date = Date()) -> PrayerEntry {
        let names = ["Fajr", "Shuruq", "Duhr", "Asr", "Maghrib", "Isha"]
        let times = ["05:36", "07:13", "12:20", "14:45", "17:18", "18:48"]
        return PrayerEntry(
            date: date,
            settings: settings,
            content: .times(Times(
                location: "London",
                dateLabel: "Sun 15 Feb",
                prayers: zip(names, times).map { WidgetPrayer(name: $0, time: $1) },
                nextIndex: 2,
                nextName: "Duhr",
                nextTime: "12:20",
                nextAt: date.addingTimeInterval(2 * 3600 + 20 * 60),
                minutesLeft: 140
            ))
        )
    }
}
