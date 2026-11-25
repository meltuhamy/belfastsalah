import XCTest

/**
 * The payload, as decoded from what the TypeScript actually writes. If
 * buildWidgetPayload changes shape, the fixtures change with it and these are
 * the tests that notice.
 */
final class WidgetPayloadTests: XCTestCase {

    func testReadsTheDayAsTheAppWroteIt() {
        let payload = Fixture.payload()
        XCTAssertEqual(payload.version, WidgetPayload.supportedVersion)
        XCTAssertEqual(payload.locationLabel, "London")
        XCTAssertEqual(payload.days[0].dateLabel, Fixture.date)
        XCTAssertEqual(payload.days[0].prayers.map(\.name), Fixture.names)
        XCTAssertEqual(payload.days[0].prayers.map(\.time), Fixture.times)
        XCTAssertEqual(payload.days[1].dateLabel, Fixture.tomorrowDate)
        XCTAssertEqual(payload.days[1].prayers.map(\.time), Fixture.tomorrowTimes)
    }

    func testCountsDownToTheInstantNamedByTheClockString() {
        // In January London is on UTC, so the instant and the string agree.
        let asr = Fixture.payload().upcoming.first { $0.name == "Asr" && $0.day == 0 }!
        XCTAssertEqual(asr.time, "14:02")
        XCTAssertEqual(asr.date, Fixture.on15th("14:02"))
    }

    func testFollowsTheAsrMethodAndTheLocation() {
        XCTAssertNotEqual(
            Fixture.payload("london-hanafi-2026-01-15").days[0].prayers[3].time,
            Fixture.times[3]
        )
        XCTAssertEqual(Fixture.payload("belfast-2026-01-15").locationLabel, "Belfast")
    }

    func testShowsIstanbulOnItsOwnClock() {
        // Diyanet's table for 15 January 2026, in Istanbul's time (UTC+3).
        let payload = Fixture.payload("istanbul-2026-01-15")
        XCTAssertEqual(payload.locationLabel, "Istanbul")
        XCTAssertEqual(
            payload.days[0].prayers.map(\.time),
            ["06:50", "08:20", "13:18", "15:45", "18:07", "19:31"]
        )
        // The countdown runs on the instant: 06:50 in Istanbul is 03:50 UTC.
        let fajr = payload.upcoming.first { $0.name == "Fajr" && $0.day == 0 }!
        XCTAssertEqual(fajr.date, Fixture.on15th("03:50"))
    }

    func testFindsTheNextPrayer() {
        let payload = Fixture.payload()
        XCTAssertEqual(payload.nextAfter(Fixture.onePM)?.name, "Asr")
        let afterIsha = payload.nextAfter(Fixture.afterIsha)
        XCTAssertEqual(afterIsha?.name, "Fajr")
        XCTAssertEqual(afterIsha?.day, 1)
    }

    func testRejectsAnythingItCannotTrust() {
        XCTAssertNil(WidgetPayload.parse(nil))
        XCTAssertNil(WidgetPayload.parse(""))
        XCTAssertNil(WidgetPayload.parse("{not json"))
        let otherVersion = Fixture.json("london-2026-01-15")
            .replacingOccurrences(of: "\"version\": 4", with: "\"version\": 99")
        XCTAssertNil(WidgetPayload.parse(otherVersion))
    }
}

/**
 * The Sky palette's colours, held to TypeScript's.
 *
 * WidgetSky repeats skyAtDays from src/lib/sky.ts. The samples are what
 * TypeScript worked out from the same London fixture, every ten minutes for
 * two days and every minute through dawn and into sunset; if the two blends
 * drift apart, this fails. WidgetSkyTest checks Android against the same file.
 */
final class SkyTests: XCTestCase {

    private struct Samples: Decodable {
        struct Sun: Decodable {
            let x: Double
            let y: Double
            let colour: String
        }

        struct Thread: Decodable {
            let x: Double
            let hazeWidth: Double
            let hazeHeight: Double
            let haze: Double
            let lineWidth: Double
            let line: Double
            let rgb: String
        }

        struct Light: Decodable {
            let sunOn: Double
            let dawn: Double
            let thread: Thread
        }

        struct Sample: Decodable {
            let at: Int64
            let top: String
            let mid: String
            let horizon: String
            let text: String
            let sun: Sun?
            let night: Double
            let light: Light
        }

        let samples: [Sample]
    }

    /**
     * How far apart two colours are, in the largest single channel. Swift's
     * and JavaScript's maths libraries can round the last bit of a power or a
     * cube root differently, which can tip a channel by one.
     */
    private func distance(_ a: String, _ b: String) -> Int {
        zip(WidgetSky.channels(a), WidgetSky.channels(b)).map { abs($0 - $1) }.max() ?? 0
    }

    func testDrawsTheSameSkyAsTheAppAtEverySample() throws {
        let payload = Fixture.payload()
        let samples = try JSONDecoder().decode(
            Samples.self, from: Data(Fixture.json("sky-london-2026-01-15").utf8)
        ).samples
        XCTAssertGreaterThan(samples.count, 400)

        for expected in samples {
            let at = Date(timeIntervalSince1970: TimeInterval(expected.at) / 1000)
            let sky = try XCTUnwrap(payload.skyAt(at))
            let label = "sample at \(expected.at)"
            XCTAssertLessThanOrEqual(distance(sky.top, expected.top), 1, "\(label) top")
            XCTAssertLessThanOrEqual(distance(sky.mid, expected.mid), 1, "\(label) mid")
            XCTAssertLessThanOrEqual(distance(sky.horizon, expected.horizon), 1, "\(label) horizon")
            XCTAssertEqual(sky.lightText, expected.text == "light", "\(label) text")
            XCTAssertEqual(sky.night, expected.night, accuracy: 1e-9, "\(label) night")
            if let sun = expected.sun {
                let actual = try XCTUnwrap(sky.sun, "\(label) sun")
                XCTAssertEqual(actual.x, sun.x, accuracy: 1e-9, label)
                XCTAssertEqual(actual.y, sun.y, accuracy: 1e-9, label)
                XCTAssertLessThanOrEqual(distance(actual.colour, sun.colour), 1, label)
            } else {
                XCTAssertNil(sky.sun, "\(label) sun")
            }

            // The sun's strength, the dawn glow and Fajr's thread.
            XCTAssertEqual(sky.light.sunOn, expected.light.sunOn, accuracy: 1e-9, "\(label) sunOn")
            XCTAssertEqual(sky.light.dawn, expected.light.dawn, accuracy: 1e-9, "\(label) dawn")
            let thread = sky.light.thread
            let wanted = expected.light.thread
            XCTAssertEqual(thread.x, wanted.x, accuracy: 1e-9, "\(label) thread x")
            XCTAssertEqual(thread.hazeWidth, wanted.hazeWidth, accuracy: 1e-9, "\(label) thread hazeWidth")
            XCTAssertEqual(thread.hazeHeight, wanted.hazeHeight, accuracy: 1e-9, "\(label) thread hazeHeight")
            XCTAssertEqual(thread.haze, wanted.haze, accuracy: 1e-9, "\(label) thread haze")
            XCTAssertEqual(thread.lineWidth, wanted.lineWidth, accuracy: 1e-9, "\(label) thread lineWidth")
            XCTAssertEqual(thread.line, wanted.line, accuracy: 1e-9, "\(label) thread line")
            XCTAssertEqual(thread.rgb, wanted.rgb, "\(label) thread rgb")
        }
    }

    func testReadsEachDaysSkyFromThePayload() {
        let payload = Fixture.payload()
        XCTAssertEqual(payload.skyColours.count, 10)
        XCTAssertTrue(payload.days.allSatisfy { $0.sky.count == 10 })
        // The 15th's dawn point is Fajr itself.
        XCTAssertEqual(payload.days[0].sky[1], Int64(Fixture.on15th("06:20").timeIntervalSince1970 * 1000))
    }

    func testRejectsADayWithoutItsSky() {
        let json = Fixture.json("london-2026-01-15")
            .replacingOccurrences(of: "\"sky\"", with: "\"skyless\"")
        XCTAssertNil(WidgetPayload.parse(json))
    }

    func testSkyColoursTheTextBlackByDayAndWhiteAtNight() {
        let day = WidgetColors(
            settings: WidgetSettings(palette: .sky), systemScheme: .light,
            sky: Fixture.payload().skyAt(Fixture.onePM)
        )
        XCTAssertEqual(day.primary, .black)
        XCTAssertEqual(day.secondary, .black)
        XCTAssertNotNil(day.sky)

        let night = WidgetColors(
            settings: WidgetSettings(palette: .sky), systemScheme: .light,
            sky: Fixture.payload().skyAt(Fixture.afterIsha)
        )
        XCTAssertEqual(night.primary, .white)
    }

    func testOtherPalettesIgnoreTheSky() {
        let colors = WidgetColors(
            settings: WidgetSettings(palette: .light), systemScheme: .light,
            sky: Fixture.payload().skyAt(Fixture.onePM)
        )
        XCTAssertNil(colors.sky)
        XCTAssertEqual(colors.background, .white)
    }
}
