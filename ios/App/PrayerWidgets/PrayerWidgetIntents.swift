import AppIntents
import WidgetKit

/*
 * What Edit Widget offers. iOS builds the sheet from these, stores the answers
 * per placed widget - two copies of one widget can differ, as on Android -
 * and hands them to the timeline provider. Each intent's only job is to
 * produce a WidgetSettings.
 */

enum CountdownOption: String, AppEnum {
    case seconds, minutes, time, none

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Countdown"
    static let caseDisplayRepresentations: [CountdownOption: DisplayRepresentation] = [
        .seconds: "Hours, minutes and seconds",
        .minutes: "Hours and minutes",
        .time: "The prayer's time instead",
        .none: "None",
    ]

    var countdown: WidgetSettings.Countdown { WidgetSettings.Countdown(rawValue: rawValue)! }
}

enum HighlightOption: String, AppEnum {
    case blue, green, amber, violet, none

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Highlight"
    static let caseDisplayRepresentations: [HighlightOption: DisplayRepresentation] = [
        .blue: "Blue", .green: "Green", .amber: "Amber", .violet: "Violet", .none: "None",
    ]

    var accent: WidgetSettings.Accent? { WidgetSettings.Accent(rawValue: rawValue) }
}

enum BackgroundOption: String, AppEnum {
    case system, light, dark

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Background"
    static let caseDisplayRepresentations: [BackgroundOption: DisplayRepresentation] = [
        .system: "Match the phone", .light: "Light", .dark: "Dark",
    ]

    var palette: WidgetSettings.Palette { WidgetSettings.Palette(rawValue: rawValue)! }
}

/** An intent the shared timeline provider can turn into settings. */
protocol SettingsIntent: WidgetConfigurationIntent {
    var settings: WidgetSettings { get }
}

/** For the home screen widgets: everything. */
struct HomeScreenWidgetIntent: SettingsIntent {
    static let title: LocalizedStringResource = "Prayer times"
    static let description = IntentDescription("Choose the countdown and colours.")

    @Parameter(title: "Countdown", default: .seconds)
    var countdown: CountdownOption

    @Parameter(title: "Highlight", default: .blue)
    var highlight: HighlightOption

    @Parameter(title: "Background", default: .system)
    var background: BackgroundOption

    @Parameter(title: "Show city", default: true)
    var showLocation: Bool

    @Parameter(title: "Show date", default: true)
    var showDate: Bool

    init() {}

    var settings: WidgetSettings {
        WidgetSettings(
            palette: background.palette,
            accent: highlight.accent,
            countdown: countdown.countdown,
            showLocation: showLocation,
            showDate: showDate
        )
    }
}

/**
 * For the lock screen: no colours, because iOS tints lock screen widgets
 * itself, and no date - there is no room for one beside the clock.
 */
struct LockScreenWidgetIntent: SettingsIntent {
    static let title: LocalizedStringResource = "Next prayer"
    static let description = IntentDescription("Choose the countdown.")

    @Parameter(title: "Countdown", default: .seconds)
    var countdown: CountdownOption

    @Parameter(title: "Show city", default: true)
    var showLocation: Bool

    init() {}

    var settings: WidgetSettings {
        WidgetSettings(
            accent: nil,
            countdown: countdown.countdown,
            showLocation: showLocation,
            showDate: false
        )
    }
}
