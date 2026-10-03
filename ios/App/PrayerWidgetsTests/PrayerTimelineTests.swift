import XCTest

/**
 * The timeline: which entries WidgetKit is given, what each says, and when
 * it is told to ask again. This is where the widget's behaviour over a day -
 * and over days without the app being opened - is decided.
 */
final class PrayerTimelineTests: XCTestCase {

    private func build(at now: Date, _ settings: WidgetSettings = WidgetSettings(),
                       payload: WidgetPayload? = Fixture.payload()) -> ([PrayerEntry], PrayerTimeline.Reload) {
        let result = PrayerTimeline.build(payload: payload, now: now, settings: settings)
        return (result.entries, result.reload)
    }

    private func times(_ entry: PrayerEntry, file: StaticString = #filePath, line: UInt = #line) -> PrayerEntry.Times? {
        guard case .times(let times) = entry.content else {
            XCTFail("expected times, got \(entry.content)", file: file, line: line)
            return nil
        }
        return times
    }

    func testStartsNowWithTheNextPrayer() throws {
        let (entries, _) = build(at: Fixture.onePM)
        XCTAssertEqual(entries[0].date, Fixture.onePM)
        let first = try XCTUnwrap(times(entries[0]))
        XCTAssertEqual(first.nextName, "Asr")
        XCTAssertEqual(first.nextTime, "14:01")
        XCTAssertEqual(first.nextIndex, 3)
        XCTAssertEqual(first.nextAt, Fixture.on15th("14:01"))
        XCTAssertEqual(first.location, "London")
        XCTAssertEqual(first.dateLabel, Fixture.date)
        XCTAssertEqual(first.prayers.map(\.time), Fixture.times)
    }

    func testHasAnEntryAtEachPrayerAfterThat() throws {
        let (entries, _) = build(at: Fixture.onePM)
        XCTAssertEqual(entries[1].date, Fixture.on15th("14:01"))
        XCTAssertEqual(try XCTUnwrap(times(entries[1])).nextName, "Maghrib")
        XCTAssertEqual(entries[2].date, Fixture.on15th("16:23"))
        XCTAssertEqual(try XCTUnwrap(times(entries[2])).nextName, "Isha")
    }

    func testShowsTomorrowOnceIshaHasGone() throws {
        // As the app's strip does: the day shown is the next prayer's.
        let (entries, _) = build(at: Fixture.afterIsha)
        let first = try XCTUnwrap(times(entries[0]))
        XCTAssertEqual(first.nextName, "Fajr")
        XCTAssertEqual(first.dateLabel, Fixture.tomorrowDate)
        XCTAssertEqual(first.prayers.map(\.time), Fixture.tomorrowTimes)
        XCTAssertEqual(first.nextIndex, 0)
    }

    func testAsksToBeOpenedWhenTheWrittenTimesRunOut() {
        let payload = Fixture.payload()
        let (entries, reload) = build(at: Fixture.onePM, payload: payload)
        XCTAssertEqual(entries.last?.content, PrayerEntry.Content.empty)
        XCTAssertEqual(entries.last?.date, payload.upcoming.last?.date)
        XCTAssertEqual(reload, .never)
    }

    func testHasNothingToShowWithoutAPayload() {
        let (entries, reload) = build(at: Fixture.onePM, payload: nil)
        XCTAssertEqual(entries.map(\.content), [.empty])
        XCTAssertEqual(reload, .never)

        let (late, _) = build(at: Fixture.on15th("23:59").addingTimeInterval(3 * 86_400))
        XCTAssertEqual(late.map(\.content), [.empty])
    }

    func testCarriesTheWidgetsSettingsIntoEveryEntry() {
        let settings = WidgetSettings(palette: .dark, accent: .amber, countdown: .time,
                                      showLocation: false, showDate: false)
        let (entries, _) = build(at: Fixture.onePM, settings)
        XCTAssertTrue(entries.allSatisfy { $0.settings == settings })
    }

    func testStopsAtTheCapAndAsksForMore() {
        let (entries, reload) = PrayerTimeline.build(
            payload: Fixture.payload(), now: Fixture.onePM,
            settings: WidgetSettings(countdown: .minutes)
        )
        XCTAssertEqual(entries.count, PrayerTimeline.maxMinuteEntries)
        XCTAssertEqual(reload, .atEnd)
    }

    func testTheMinutesCountdownHasAnEntryEachMinute() throws {
        let (entries, _) = build(at: Fixture.onePM, WidgetSettings(countdown: .minutes))
        // 12:59:59.5 to Asr at 14:01 is 61 minutes and a half second: 62,
        // rounded up, then 61 from 13:00 exactly, and so on down to 1.
        let lefts = try entries.prefix(63).map { try XCTUnwrap(times($0)).minutesLeft }
        XCTAssertEqual(lefts.prefix(3), [62, 61, 60])
        XCTAssertEqual(entries[1].date, Fixture.on15th("13:00"))
        XCTAssertEqual(entries[2].date, Fixture.on15th("13:01"))
        // The last for Asr reads 1, and the next entry is Maghrib's first.
        XCTAssertEqual(entries[62].date, Fixture.on15th("14:01"))
        XCTAssertEqual(try XCTUnwrap(times(entries[61])).minutesLeft, 1)
        XCTAssertEqual(try XCTUnwrap(times(entries[62])).nextName, "Maghrib")
    }

    func testMinutesTextReadsNaturally() {
        XCTAssertEqual(minutesText(62), "1h 2m")
        XCTAssertEqual(minutesText(60), "1h 0m")
        XCTAssertEqual(minutesText(59), "59 min")
        XCTAssertEqual(minutesText(1), "1 min")
    }
}
