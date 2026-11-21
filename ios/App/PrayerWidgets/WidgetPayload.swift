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
    /**
     * The day's ten sky points as epoch milliseconds, in the order
     * `WidgetPayload.skyColours` lists their colours - what WidgetSky works from.
     */
    let sky: [Int64]
}

struct WidgetPayload: Codable, Equatable {
    /** Must match WIDGET_PAYLOAD_VERSION in src/lib/widgetPayload.ts. */
    static let supportedVersion = 4

    /** A day's sky points: SKY_PHASES in src/lib/sky.ts. */
    static let skyPoints = 10

    let version: Int
    let locationLabel: String
    let days: [WidgetDay]
    let upcoming: [WidgetUpcoming]
    /** Each sky point's colours, in the same order as every day's `sky`. */
    let skyColours: [SkyColours]

    /**
     * Nil for anything unusable - absent, malformed, or written by a version
     * that does not match. Showing nothing is right here: a wrong prayer time
     * is worse than a widget asking to be opened.
     */
    static func parse(_ json: String?) -> WidgetPayload? {
        guard let data = json?.data(using: .utf8),
              let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data),
              payload.version == supportedVersion,
              // The sky needs a whole day of points and a colour for each.
              payload.skyColours.count == skyPoints,
              payload.days.allSatisfy({ $0.sky.count == skyPoints })
        else { return nil }
        return payload
    }

    /** The sky a Sky widget draws at this moment, or nil with no days to draw it from. */
    func skyAt(_ now: Date) -> SkyState? {
        guard !days.isEmpty else { return nil }
        return WidgetSky.at(
            Int64((now.timeIntervalSince1970 * 1000).rounded(.down)),
            days: days.map(\.sky),
            colours: skyColours
        )
    }

    /** The first prayer still ahead, or nil once the written window runs out. */
    func nextAfter(_ now: Date) -> WidgetUpcoming? {
        upcoming.first { $0.date > now }
    }
}

// MARK: - The sky

/** One sky point's colours, top of the sky to the horizon, as "#rrggbb". */
struct SkyColours: Codable, Equatable {
    let top: String
    let mid: String
    let horizon: String
}

/** Where the sun is, as fractions of the widget: x from the left, y from the top. */
struct SkySun: Equatable {
    let x: Double
    let y: Double
    let colour: String
}

/** The sky at one moment: what a Sky widget draws. */
struct SkyState: Equatable {
    let top: String
    let mid: String
    let horizon: String
    /** White text rather than black. */
    let lightText: Bool
    /** Nil while the sun is well below the horizon. */
    let sun: SkySun?
    /** 0 by day, 1 once the stars are fully out. */
    let night: Double
}

/**
 * The sky for a moment, worked out exactly as skyAtDays in src/lib/sky.ts
 * does - a line-by-line port, from the points and colours the app sends in
 * the payload, as is WidgetSky.kt on Android.
 *
 * The one piece of calculation the widgets do themselves, because the sky
 * changes all day and the payload is written only when the app runs.
 * SkyTests holds it to fixtures/widget-payload/sky-london-2026-01-15.json,
 * which TypeScript writes from its own answer.
 */
enum WidgetSky {

    private static let minute = 60_000.0

    /**
     * `days` are each day's ten point times, as the payload writes them. Uses
     * the last day that has begun: between one day's last point and the next
     * day's first, both are the same night.
     */
    static func at(_ t: Int64, days: [[Int64]], colours: [SkyColours]) -> SkyState {
        var chosen = days[0]
        for times in days where times[0] <= t {
            chosen = times
        }
        return atTimes(t, chosen, colours)
    }

    static func atTimes(_ t: Int64, _ times: [Int64], _ colours: [SkyColours]) -> SkyState {
        // Night: the first point's colours, which the last point's repeat.
        var sky = colours[0]
        for i in 0..<(times.count - 1) where t >= times[i] && t < times[i + 1] {
            sky = blend(colours[i], colours[i + 1], Double(t - times[i]) / Double(times[i + 1] - times[i]))
            break
        }

        let fajr = Double(times[1])
        let shuruq = Double(times[2])
        let maghrib = Double(times[7])
        let isha = Double(times[8])
        let now = Double(t)

        let progress = (now - shuruq) / (maghrib - shuruq)
        let elevation = sin(Double.pi * progress)
        let sunUp = now >= shuruq - 45 * minute && now <= maghrib + 45 * minute

        var night = 0.0
        if now >= isha {
            night = min(1, (now - isha) / (60 * minute))
        } else if now < fajr {
            night = min(1, (fajr - now) / (40 * minute))
        }

        return SkyState(
            top: sky.top,
            mid: sky.mid,
            horizon: sky.horizon,
            lightText: lightText(sky.top, sky.mid),
            sun: sunUp ? SkySun(
                x: 0.08 + clamp(progress, -0.1, 1.1) * 0.84,
                y: 0.9 - elevation * 0.66,
                colour: mixOklab("#ff9e4a", "#fff7dc", clamp(elevation * 1.6, 0, 1))
            ) : nil,
            night: night
        )
    }

    // MARK: The blend, as in sky.ts

    private static let evenLuminance = (1.05 * 0.05).squareRoot() - 0.05

    private static let crossingsLock = NSLock()
    private static var crossings: [String: Double?] = [:]

    private static func crossing(_ a: String, _ b: String) -> Double? {
        let key = a + b
        crossingsLock.lock()
        let cached = crossings[key]
        crossingsLock.unlock()
        if let cached { return cached }

        func side(_ f: Double) -> Bool { luminance(mixOklab(a, b, f)) > evenLuminance }
        var result: Double?
        if side(0) != side(1) {
            var lo = 0.0
            var hi = 1.0
            for _ in 0..<30 {
                let midpoint = (lo + hi) / 2
                if side(midpoint) == side(0) { lo = midpoint } else { hi = midpoint }
            }
            result = (lo + hi) / 2
        }
        crossingsLock.lock()
        crossings[key] = .some(result)
        crossingsLock.unlock()
        return result
    }

    private static func bend(_ f: Double, _ from: Double, _ to: Double) -> Double {
        f <= from ? (f * to) / from : to + ((f - from) * (1 - to)) / (1 - from)
    }

    private static func blend(_ a: SkyColours, _ b: SkyColours, _ f: Double) -> SkyColours {
        let top = crossing(a.top, b.top)
        let mid = crossing(a.mid, b.mid)
        let horizon = crossing(a.horizon, b.horizon)

        var midF = f
        var midAt = mid
        if let top, let mid {
            midF = bend(f, top, mid)
            midAt = top
        }
        var horizonF = f
        if let midAt, let horizon {
            horizonF = bend(f, midAt, horizon)
        }

        return SkyColours(
            top: mixOklab(a.top, b.top, f),
            mid: mixOklab(a.mid, b.mid, midF),
            horizon: mixOklab(a.horizon, b.horizon, horizonF)
        )
    }

    private static func lightText(_ a: String, _ b: String) -> Bool {
        func worst(_ text: String) -> Double { min(contrastRatio(text, a), contrastRatio(text, b)) }
        return worst("#ffffff") >= worst("#000000")
    }

    // MARK: Colour arithmetic, as in sky.ts

    private static func clamp(_ x: Double, _ lo: Double, _ hi: Double) -> Double { max(lo, min(hi, x)) }

    static func channels(_ hex: String) -> [Int] {
        let n = Int(hex.dropFirst(), radix: 16) ?? 0
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }

    private static func toHex(_ rgb: [Double]) -> String {
        // JavaScript's Math.round: halves go up. rounded() takes them away
        // from zero, which is the same for these, all positive.
        "#" + rgb.map { String(format: "%02x", Int(clamp($0, 0, 255).rounded())) }.joined()
    }

    private static func toLinear(_ c: Int) -> Double {
        let v = Double(c) / 255
        return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
    }

    private static func fromLinear(_ v: Double) -> Double {
        255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055)
    }

    private static func toOklab(_ hex: String) -> [Double] {
        let c = channels(hex).map(toLinear)
        let (r, g, b) = (c[0], c[1], c[2])
        let l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        let m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        let s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        return [
            0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
        ]
    }

    private static func fromOklab(_ lab: [Double]) -> String {
        let (L, a, b) = (lab[0], lab[1], lab[2])
        let l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3)
        let m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3)
        let s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3)
        return toHex([
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
        ].map { fromLinear(clamp($0, 0, 1)) })
    }

    static func mixOklab(_ a: String, _ b: String, _ f: Double) -> String {
        let x = toOklab(a)
        let y = toOklab(b)
        return fromOklab((0..<3).map { x[$0] + (y[$0] - x[$0]) * f })
    }

    private static func luminance(_ hex: String) -> Double {
        let c = channels(hex).map(toLinear)
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }

    private static func contrastRatio(_ a: String, _ b: String) -> Double {
        let x = luminance(a)
        let y = luminance(b)
        return (max(x, y) + 0.05) / (min(x, y) + 0.05)
    }
}
