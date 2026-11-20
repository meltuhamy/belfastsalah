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
            .replacingOccurrences(of: "\"version\": 3", with: "\"version\": 99")
        XCTAssertNil(WidgetPayload.parse(otherVersion))
    }
}
