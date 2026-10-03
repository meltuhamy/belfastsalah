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
