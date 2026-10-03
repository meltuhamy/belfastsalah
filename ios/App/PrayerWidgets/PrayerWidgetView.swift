import SwiftUI
import WidgetKit

/**
 * The widget as WidgetKit draws it: reads the family and the phone's
 * appearance from the environment and passes them on explicitly.
 *
 * Everything below takes them as parameters instead, because tests cannot set
 * either - the environment values are read-only outside WidgetKit - and a
 * view that only reads them can only be tested in one size and one mode.
 */
struct PrayerWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme

    let entry: PrayerEntry

    var body: some View {
        let colors = WidgetColors(settings: entry.settings, systemScheme: scheme)
        PrayerWidgetContent(entry: entry, family: family, colors: colors)
            .containerBackground(for: .widget) {
                switch family {
                case .accessoryCircular: AccessoryWidgetBackground()
                case .accessoryRectangular, .accessoryInline: Color.clear
                default: colors.background
                }
            }
    }
}

/** What each family draws, given everything explicitly. */
struct PrayerWidgetContent: View {
    let entry: PrayerEntry
    let family: WidgetFamily
    let colors: WidgetColors

    var body: some View {
        switch entry.content {
        case .empty:
            EmptyContent(family: family, colors: colors, note: entry.note)
        case .times(let times):
            switch family {
            case .systemSmall:
                SmallContent(times: times, settings: entry.settings, colors: colors)
            case .systemMedium:
                MediumContent(times: times, settings: entry.settings, colors: colors)
            case .systemLarge, .systemExtraLarge:
                LargeContent(times: times, settings: entry.settings, colors: colors)
            case .accessoryRectangular:
                RectangularContent(times: times, settings: entry.settings)
            case .accessoryCircular:
                CircularContent(times: times, settings: entry.settings)
            case .accessoryInline:
                InlineContent(times: times, settings: entry.settings)
            default:
                SmallContent(times: times, settings: entry.settings, colors: colors)
            }
        }
    }
}

// MARK: - Shared pieces

/** "Asr in", "Asr at" or just "Asr", to sit above whichever countdown is shown. */
private func label(_ times: PrayerEntry.Times, _ countdown: WidgetSettings.Countdown) -> String {
    switch countdown {
    case .seconds, .minutes: return "\(times.nextName) in"
    case .time: return "\(times.nextName) at"
    case .none: return times.nextName
    }
}

/** "1h 23m", "23 min" under the hour, and "<1 min" in the last one. */
func minutesText(_ minutes: Int) -> String {
    let hours = minutes / 60
    let rest = minutes % 60
    if hours > 0 { return "\(hours)h \(rest)m" }
    return rest > 0 ? "\(rest) min" : "<1 min"
}

/** The countdown in whichever form was chosen; for `.none`, the time. */
private struct Countdown: View {
    let times: PrayerEntry.Times
    let mode: WidgetSettings.Countdown
    /**
     * How far the big countdown may shrink. On the smallest phones a small
     * widget is narrower than "12:18:00" at full size - after Isha, with
     * tomorrow's Fajr hours away - and shrinking is better than "12:1…".
     */
    var minimumScale: CGFloat = 0.7

    var body: some View {
        switch mode {
        case .seconds:
            // Timer text takes all the width it is offered; the alignment is
            // what keeps it where the layout puts it.
            Text(times.nextAt, style: .timer)
                .multilineTextAlignment(.leading)
                .shrinkable("countdown", minimumScale: minimumScale)
        case .minutes:
            Text(minutesText(times.minutesLeft)).shrinkable("countdown", minimumScale: minimumScale)
        case .time, .none:
            Text(times.nextTime).shrinkable("countdown", minimumScale: minimumScale)
        }
    }
}

/** The next prayer's name in the highlight colour, or plain if there is none. */
private struct NextPill: View {
    let text: String
    let colors: WidgetColors

    var body: some View {
        if let accent = colors.accent {
            Text(text)
                .fitProbe("label")
                .foregroundStyle(colors.onAccent)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Capsule().fill(accent))
                .widgetAccentable()
        } else {
            Text(text).fitProbe("label").foregroundStyle(colors.primary)
        }
    }
}

/** "London · Thu 15 Jan", or whichever half is wanted, or nothing. */
private func placeLine(_ times: PrayerEntry.Times, _ settings: WidgetSettings) -> String? {
    let parts = [
        settings.showLocation ? times.location : nil,
        settings.showDate ? times.dateLabel : nil,
    ].compactMap { $0 }
    return parts.isEmpty ? nil : parts.joined(separator: " · ")
}

private struct EmptyContent: View {
    let family: WidgetFamily
    let colors: WidgetColors
    var note: String? = nil

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("Open Prayer Times")
        case .accessoryCircular:
            Image(systemName: "clock")
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text("No times").font(.headline)
                Text("Open the app").font(.caption)
            }
        default:
            VStack(spacing: 4) {
                Text("No times").font(.headline).foregroundStyle(colors.primary)
                Text("Open the app").font(.caption).foregroundStyle(colors.secondary)
                #if DEBUG
                if let note {
                    Text(note).font(.caption2).foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
                #endif
            }
        }
    }
}

// MARK: - Home screen

private struct SmallContent: View {
    let times: PrayerEntry.Times
    let settings: WidgetSettings
    let colors: WidgetColors

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            NextPill(text: label(times, settings.countdown), colors: colors)
                .font(.subheadline.weight(.semibold))
            Countdown(times: times, mode: settings.countdown)
                .font(.system(size: 30, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(colors.primary)
            Spacer(minLength: 0)
            if settings.countdown == .seconds || settings.countdown == .minutes {
                Text(times.nextTime)
                    .font(.headline)
                    .foregroundStyle(colors.primary)
                    .fitProbe("time")
            }
            if settings.showLocation {
                Text(times.location).font(.caption).foregroundStyle(colors.secondary).fitProbe("location")
            }
            if settings.showDate {
                Text(times.dateLabel).font(.caption).foregroundStyle(colors.secondary).fitProbe("date")
            }
        }
        .lineLimit(1)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/** The countdown on the left, where and when on the right. */
private struct Header: View {
    let times: PrayerEntry.Times
    let settings: WidgetSettings
    let colors: WidgetColors

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                NextPill(text: label(times, settings.countdown), colors: colors)
                    .font(.subheadline.weight(.semibold))
                Countdown(times: times, mode: settings.countdown)
                    .font(.system(size: 28, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(colors.primary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                if settings.showLocation {
                    Text(times.location).font(.subheadline.weight(.medium))
                        .foregroundStyle(colors.primary).fitProbe("location")
                }
                if settings.showDate {
                    Text(times.dateLabel).font(.caption)
                        .foregroundStyle(colors.secondary).fitProbe("date")
                }
            }
        }
        .lineLimit(1)
    }
}

private struct MediumContent: View {
    let times: PrayerEntry.Times
    let settings: WidgetSettings
    let colors: WidgetColors

    var body: some View {
        VStack(spacing: 0) {
            Header(times: times, settings: settings, colors: colors)
            Spacer(minLength: 6)
            HStack(spacing: 2) {
                ForEach(Array(times.prayers.enumerated()), id: \.offset) { index, prayer in
                    let next = index == times.nextIndex
                    VStack(spacing: 2) {
                        // Six to a row: "Maghrib" fills its column on a small
                        // phone at a larger text size, so names may shrink a
                        // little rather than be cut.
                        Text(prayer.name).font(.caption2)
                            .shrinkable("name.\(index)", minimumScale: 0.8)
                        Text(prayer.time).font(.footnote.weight(.semibold)).monospacedDigit()
                            .fitProbe("time.\(index)")
                    }
                    .lineLimit(1)
                    .foregroundStyle(next && colors.accent != nil ? colors.onAccent : colors.primary)
                    .padding(.vertical, 5)
                    .frame(maxWidth: .infinity)
                    .background {
                        if next, let accent = colors.accent {
                            RoundedRectangle(cornerRadius: 8).fill(accent).widgetAccentable()
                        }
                    }
                }
            }
        }
    }
}

private struct LargeContent: View {
    let times: PrayerEntry.Times
    let settings: WidgetSettings
    let colors: WidgetColors

    var body: some View {
        VStack(spacing: 0) {
            Header(times: times, settings: settings, colors: colors)
            Spacer(minLength: 10)
            VStack(spacing: 4) {
                ForEach(Array(times.prayers.enumerated()), id: \.offset) { index, prayer in
                    let next = index == times.nextIndex
                    HStack {
                        Text(prayer.name).font(.body.weight(next ? .semibold : .regular))
                            .fitProbe("name.\(index)")
                        Spacer()
                        Text(prayer.time).font(.body.weight(.semibold)).monospacedDigit()
                            .fitProbe("time.\(index)")
                    }
                    .lineLimit(1)
                    .foregroundStyle(next && colors.accent != nil ? colors.onAccent : colors.primary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background {
                        if next, let accent = colors.accent {
                            RoundedRectangle(cornerRadius: 10).fill(accent).widgetAccentable()
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Lock screen
//
// No colours here: iOS draws lock screen widgets in its own tint.

private struct RectangularContent: View {
    let times: PrayerEntry.Times
    let settings: WidgetSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label(times, settings.countdown)).font(.headline).fitProbe("label")
            Countdown(times: times, mode: settings.countdown)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
            if settings.showLocation {
                Text(times.location).font(.caption).foregroundStyle(.secondary).fitProbe("location")
            }
        }
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct CircularContent: View {
    let times: PrayerEntry.Times
    let settings: WidgetSettings

    var body: some View {
        VStack(spacing: 0) {
            Text(times.nextName).font(.system(size: 12, weight: .semibold)).fitProbe("label")
            Group {
                switch settings.countdown {
                case .seconds:
                    Text(times.nextAt, style: .timer).multilineTextAlignment(.center)
                case .minutes:
                    Text(minutesText(times.minutesLeft))
                case .time, .none:
                    Text(times.nextTime)
                }
            }
            .font(.system(size: 12, weight: .medium))
            .monospacedDigit()
            .fitProbe("countdown")
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
}

private struct InlineContent: View {
    let times: PrayerEntry.Times
    let settings: WidgetSettings

    var body: some View {
        switch settings.countdown {
        case .seconds:
            Text("\(times.nextName) in ") + Text(times.nextAt, style: .timer)
        case .minutes:
            Text("\(times.nextName) in \(minutesText(times.minutesLeft))")
        case .time, .none:
            Text("\(times.nextName) \(times.nextTime)")
        }
    }
}
