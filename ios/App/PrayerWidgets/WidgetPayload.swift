import Foundation

/**
 * The payload the app writes, as the widgets see it.
 *
 * Deliberately dumb, like WidgetPayload.kt. Everything that could be got
 * wrong about prayer times - which day's row, which asr column, which
 * timezone - was decided in src/lib/widgetPayload.ts, where it is tested.
 * `time` values are display strings shown as they are; `at` values are UTC
 * instants used only as the countdown's target. Nothing here does date
 * arithmetic on the calendar.
 */
struct WidgetPrayer: Codable, Equatable {
    let name: String
    let time: String
}

/** `day` indexes `WidgetPayload.days`: the day this prayer belongs to. */
struct WidgetUpcoming: Codable, Equatable {
    let name: String
    /** Epoch milliseconds. */
    let at: Int64
    let time: String
    let day: Int

    var date: Date { Date(timeIntervalSince1970: TimeInterval(at) / 1000) }
}

struct WidgetDay: Codable, Equatable {
    let dateLabel: String
    let prayers: [WidgetPrayer]
}

struct WidgetPayload: Codable, Equatable {
    /** Must match WIDGET_PAYLOAD_VERSION in src/lib/widgetPayload.ts. */
    static let supportedVersion = 3

    let version: Int
    let locationLabel: String
    let days: [WidgetDay]
    let upcoming: [WidgetUpcoming]

    /**
     * Nil for anything unusable - absent, malformed, or written by a version
     * that does not match. Showing nothing is right here: a wrong prayer time
     * is worse than a widget asking to be opened.
     */
    static func parse(_ json: String?) -> WidgetPayload? {
        guard let data = json?.data(using: .utf8),
              let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data),
              payload.version == supportedVersion
        else { return nil }
        return payload
    }

    /** The first prayer still ahead, or nil once the written window runs out. */
    func nextAfter(_ now: Date) -> WidgetUpcoming? {
        upcoming.first { $0.date > now }
    }
}
