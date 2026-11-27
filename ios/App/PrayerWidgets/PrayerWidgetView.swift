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
        let colors = WidgetColors(settings: entry.settings, systemScheme: scheme, sky: entry.sky)
        PrayerWidgetContent(entry: entry, family: family, colors: colors)
            .containerBackground(for: .widget) {
                switch family {
                case .accessoryCircular: AccessoryWidgetBackground()
                case .accessoryRectangular, .accessoryInline: Color.clear
                default: WidgetBackground(colors: colors, family: family)
                }
            }
    }
}

/** The widget's background: the sky for the Sky palette, else a plain colour. */
struct WidgetBackground: View {
    let colors: WidgetColors
    let family: WidgetFamily

    var body: some View {
        if let sky = colors.sky {
            SkyBackground(sky: sky, sunArc: family == .systemMedium ? .medium : .raw)
        } else {
            colors.background
        }
    }
}

/**
 * Where the sun sits, as fractions of the widget's height: `noonY` at the top
 * of the sky arc and `horizonY` at its ends. The arc itself runs from 0.24 to
 * 0.9; `map` squeezes it into this range. Android's `SkyPainter.SunArc`.
 */
struct SunArc {
    let noonY: Double
    let horizonY: Double

    /** The sky's own arc, drawn as it is. */
    static let raw = SunArc(noonY: 0.24, horizonY: 0.9)
    /** Medium widgets: a touch lower at noon, and above the prayer row at sunset. */
    static let medium = SunArc(noonY: 0.28, horizonY: 0.61)

    func map(_ rawY: Double) -> Double {
        noonY + (rawY - Self.raw.noonY) * (horizonY - noonY) / (Self.raw.horizonY - Self.raw.noonY)
    }
}

/**
 * The sky as the app's countdown card draws it: a gradient from its top down
 * to the horizon, the sun on its arc, and stars after Isha.
 */
struct SkyBackground: View {
    let sky: SkyState
    var sunArc: SunArc = .raw

    /** Fractions across and down, a radius in points and a strength. */
    private static let stars: [(x: Double, y: Double, r: Double, o: Double)] = [
        (0.06, 0.14, 1.0, 0.9), (0.14, 0.38, 0.75, 0.6), (0.22, 0.09, 0.75, 0.7),
        (0.31, 0.26, 1.0, 0.8), (0.40, 0.12, 0.75, 0.5), (0.48, 0.34, 0.75, 0.6),
        (0.57, 0.08, 1.0, 0.9), (0.64, 0.22, 0.75, 0.6), (0.72, 0.40, 0.75, 0.5),
        (0.79, 0.13, 1.0, 0.8), (0.87, 0.30, 0.75, 0.6), (0.94, 0.10, 0.75, 0.7),
        (0.36, 0.46, 0.75, 0.4), (0.84, 0.52, 0.75, 0.4),
    ]

    private static func rgb(_ r: Double, _ g: Double, _ b: Double, _ alpha: Double) -> Color {
        Color(red: r / 255, green: g / 255, blue: b / 255).opacity(min(1, max(0, alpha)))
    }

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            ZStack {
                LinearGradient(
                    stops: [
                        .init(color: Color(hex: sky.top), location: 0),
                        .init(color: Color(hex: sky.mid), location: 0.6),
                        .init(color: Color(hex: sky.horizon), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                if sky.night > 0 {
                    ForEach(Array(Self.stars.enumerated()), id: \.offset) { _, star in
                        Circle()
                            .fill(Color.white.opacity(star.o * sky.night))
                            .frame(width: star.r * 2, height: star.r * 2)
                            .position(x: star.x * size.width, y: star.y * size.height)
                    }
                }
                // Before sunrise, a warm glow on the horizon at the left,
                // where the sun will come up, as the app's card draws it.
                if sky.light.dawn > 0 {
                    let d = sky.light.dawn
                    Ellipse()
                        .fill(EllipticalGradient(stops: [
                            .init(color: Self.rgb(255, 196, 120, 0.9 * d), location: 0),
                            .init(color: Self.rgb(255, 160, 90, 0.6 * d), location: 0.3),
                            .init(color: Self.rgb(255, 130, 90, 0.22 * d), location: 0.65),
                            .init(color: Self.rgb(255, 120, 90, 0), location: 1),
                        ]))
                        .frame(width: size.width * 1.3, height: size.height * 0.7)
                        .position(x: 0, y: size.height * 0.6)
                }
                // Fajr's white thread in a haze. The sizes are the card's,
                // 252 points tall; a shorter widget gets a shallower haze,
                // never less than about half. Still, where the card's line
                // breathes: nothing on a widget can move.
                let thread = sky.light.thread
                if thread.haze > 0 || thread.line > 0 {
                    let c = thread.rgb.split(separator: ",").map {
                        Double($0.trimmingCharacters(in: .whitespaces)) ?? 255
                    }
                    let depth = min(1, max(0.55, size.height / 252))
                    let centre = CGPoint(x: thread.x * size.width, y: size.height * 0.5)
                    if thread.haze > 0 {
                        Ellipse()
                            .fill(EllipticalGradient(stops: [
                                .init(color: Self.rgb(c[0], c[1], c[2], thread.haze), location: 0),
                                .init(color: Self.rgb(c[0], c[1], c[2], thread.haze * 0.62), location: 0.35),
                                .init(color: Self.rgb(c[0], c[1], c[2], thread.haze * 0.25), location: 0.65),
                                .init(color: Self.rgb(c[0], c[1], c[2], 0), location: 1),
                            ]))
                            .frame(width: thread.hazeWidth * size.width, height: thread.hazeHeight * depth)
                            .position(centre)
                    }
                    if thread.line > 0 {
                        Ellipse()
                            .fill(EllipticalGradient(stops: [
                                .init(color: Self.rgb(c[0], c[1], c[2], thread.line), location: 0),
                                .init(color: Self.rgb(c[0], c[1], c[2], thread.line * 0.5), location: 0.45),
                                .init(color: Self.rgb(c[0], c[1], c[2], 0), location: 1),
                            ]))
                            .frame(width: thread.lineWidth * size.width, height: 4)
                            .position(centre)
                    }
                }
                // The sun at the card's strength: none before Shuruq, fading
                // after Maghrib, though the arc keeps it 45 minutes either side.
                if let sun = sky.sun, sky.light.sunOn > 0 {
                    Circle()
                        .fill(Color(hex: sun.colour))
                        .frame(width: 26, height: 26)
                        .shadow(color: Color(hex: sun.colour).opacity(0.5), radius: 14)
                        .position(x: sun.x * size.width, y: sunArc.map(sun.y) * size.height)
                        .opacity(sky.light.sunOn)
                }
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
        Group { content }
            // Dynamic Type, as far as this family has room for (MEL-105).
            .dynamicTypeSize(...family.largestTypeSize)
    }

    @ViewBuilder private var content: some View {
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

extension WidgetFamily {
    /**
     * The largest Dynamic Type size a family's text follows (MEL-105).
     *
     * A widget does not grow with its text, so past a point a larger size
     * only cuts it off: at the largest accessibility size the medium widget's
     * times lost their minutes. Each cap is the largest size at which
     * WidgetFitTests finds nothing cut off, on the smallest phone and the
     * largest, at every size up to the largest accessibility one. One size
     * more and the SE's medium widget cuts its names and times, and its
     * small widget "Maghrib in".
     */
    var largestTypeSize: DynamicTypeSize {
        switch self {
        case .systemSmall: return .xxLarge
        case .systemMedium: return .xLarge
        case .systemLarge, .systemExtraLarge: return .xxxLarge
        case .accessoryRectangular: return .xxxLarge
        default: return .xxxLarge
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
