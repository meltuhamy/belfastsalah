import SwiftUI

/**
 * How one placed widget should look - what the user chose in Edit Widget,
 * as a plain value the views and the timeline take. The App Intent types
 * (PrayerWidgetIntents.swift) only exist to produce one of these, so tests
 * and previews never need an intent.
 *
 * Android's opacity and text tone have no counterpart: iOS does not allow a
 * see-through widget, and in its tinted and clear modes it picks the colours
 * itself.
 */
struct WidgetSettings: Equatable {
    var palette: Palette = .system
    var accent: Accent? = .blue
    var countdown: Countdown = .seconds
    /**
     * Whether to name the city and date the times belong to. On by default,
     * and the first thing to go on a home screen that already answers both.
     */
    var showLocation = true
    var showDate = true

    enum Palette: String, CaseIterable { case system, light, dark }

    enum Countdown: String, CaseIterable {
        /** "1:23:45", ticked by the system at no cost to us. */
        case seconds
        /**
         * "1h 23m". iOS has no live text style without seconds, so this is
         * one timeline entry a minute - see PrayerTimeline.
         */
        case minutes
        /** The prayer's clock time instead of a countdown. */
        case time
        case none
    }

    enum Accent: String, CaseIterable {
        case blue, green, amber, violet

        /** The same colours as the Android widgets' highlights. */
        var color: Color {
            switch self {
            case .blue: return Color(red: 0x38 / 255, green: 0x80 / 255, blue: 0xFF / 255)
            case .green: return Color(red: 0x2D / 255, green: 0xD3 / 255, blue: 0x6F / 255)
            case .amber: return Color(red: 0xFF / 255, green: 0xC4 / 255, blue: 0x09 / 255)
            case .violet: return Color(red: 0x52 / 255, green: 0x60 / 255, blue: 0xFF / 255)
            }
        }

        var onAccent: Color {
            switch self {
            case .blue, .violet: return .white
            case .green, .amber: return .black
            }
        }
    }
}

/** Colours resolved for one drawing: "system" only means something at draw time. */
struct WidgetColors {
    let background: Color
    let primary: Color
    let secondary: Color
    let accent: Color?
    let onAccent: Color

    init(settings: WidgetSettings, systemScheme: ColorScheme) {
        let dark: Bool
        switch settings.palette {
        case .system: dark = systemScheme == .dark
        case .light: dark = false
        case .dark: dark = true
        }
        background = dark ? Color(white: 0x1E / 255) : .white
        primary = dark ? .white : Color(white: 0x1B / 255)
        secondary = dark ? Color(white: 0xB3 / 255) : Color(red: 0x5F / 255, green: 0x63 / 255, blue: 0x68 / 255)
        accent = settings.accent?.color
        onAccent = settings.accent?.onAccent ?? primary
    }
}
