import Foundation
import XCTest
@testable import NudgioKernel

/// The cases of `OccurrenceCalculatorTest.kt`: both phones must agree on
/// when a rule fires, DST included.
final class ScheduleEngineTests: XCTestCase {
    let zone = TimeZone(identifier: "America/New_York")!

    func at(_ y: Int, _ m: Int, _ d: Int, _ h: Int, _ min: Int, in zone: TimeZone? = nil) -> Date {
        ScheduleEngine.resolveLocal(LocalDate(year: y, month: m, day: d), LocalTime(hour: h, minute: min), in: zone ?? self.zone)
    }

    func next(_ rule: ScheduleRule, after: Date, preferLater: Bool = false) -> Date? {
        ScheduleEngine.nextOccurrence(rule, in: zone, after: after, preferLaterOnOverlap: preferLater)
    }

    func testOnceIsReturnedOnlyWhileAhead() {
        let target = at(2026, 4, 10, 9, 0)
        XCTAssertEqual(next(.once(instant: target, originZone: "America/New_York"), after: target.addingTimeInterval(-60)), target)
        XCTAssertNil(next(.once(instant: target, originZone: "America/New_York"), after: target))
    }

    func testDailyRollsToTodayOrTomorrow() {
        let rule = ScheduleRule.daily(LocalTime(hour: 6, minute: 15))
        XCTAssertEqual(next(rule, after: at(2026, 4, 10, 5, 0)), at(2026, 4, 10, 6, 15))
        XCTAssertEqual(next(rule, after: at(2026, 4, 10, 7, 0)), at(2026, 4, 11, 6, 15))
    }

    func testWeeklyCrossesAWeekBoundary() {
        // Friday 10 April 2026 → Monday 13 April.
        let rule = ScheduleRule.weekdays(LocalTime(hour: 14, minute: 30), isoWeekdays: [1, 3])
        XCTAssertEqual(next(rule, after: at(2026, 4, 10, 15, 0)), at(2026, 4, 13, 14, 30))
        XCTAssertEqual(ScheduleEngine.isoWeekday(of: LocalDate(year: 2026, month: 4, day: 13)), 1)
    }

    func testMonthlyClampsAndAdvances() {
        let day31 = ScheduleRule.monthly(LocalTime(hour: 9, minute: 0), dayOfMonth: 31)
        XCTAssertEqual(next(day31, after: at(2026, 2, 1, 0, 0)), at(2026, 2, 28, 9, 0))
        let day1 = ScheduleRule.monthly(LocalTime(hour: 9, minute: 0), dayOfMonth: 1)
        XCTAssertEqual(next(day1, after: at(2026, 4, 2, 0, 0)), at(2026, 5, 1, 9, 0))
    }

    func testYearlyLeapDay() {
        let rule = ScheduleRule.yearly(LocalTime(hour: 8, minute: 0), month: 2, dayOfMonth: 29)
        XCTAssertEqual(next(rule, after: at(2026, 1, 1, 0, 0)), at(2026, 2, 28, 8, 0))
        XCTAssertEqual(next(rule, after: at(2027, 3, 1, 0, 0)), at(2028, 2, 29, 8, 0))
    }

    func testCustomIsAnchorAligned() {
        let anchor = LocalDate(year: 2026, month: 8, day: 1)
        let rule = ScheduleRule.custom(LocalTime(hour: 10, minute: 0), intervalDays: 3, anchorDate: anchor)
        XCTAssertEqual(next(rule, after: at(2026, 8, 5, 12, 0)), at(2026, 8, 7, 10, 0))
        XCTAssertEqual(next(rule, after: at(2026, 7, 20, 0, 0)), at(2026, 8, 1, 10, 0))
    }

    func testSpringForwardGapMovesLaterByTheGap() {
        // 12 March 2023, New York: 02:00 → 03:00. 02:30 does not exist.
        let resolved = next(.daily(LocalTime(hour: 2, minute: 30)), after: at(2023, 3, 12, 0, 0))!
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: resolved)
        XCTAssertEqual([parts.month, parts.day, parts.hour, parts.minute], [3, 12, 3, 30])
    }

    func testFallBackOverlapTakesTheFirstUnlessAskedForTheLater() {
        // 5 November 2023, New York: 01:30 happens at -04:00 and again at -05:00.
        let rule = ScheduleRule.daily(LocalTime(hour: 1, minute: 30))
        let first = next(rule, after: at(2023, 11, 5, 0, 0))!
        let second = next(rule, after: at(2023, 11, 5, 0, 0), preferLater: true)!
        XCTAssertEqual(zone.secondsFromGMT(for: first), -4 * 3600)
        XCTAssertEqual(second.timeIntervalSince(first), 3600)
    }

    func testTheSameRuleResolvesPerZone() {
        let rule = ScheduleRule.daily(LocalTime(hour: 9, minute: 0))
        let after = Date(timeIntervalSince1970: 1_775_000_000)
        let utc = ScheduleEngine.nextOccurrence(rule, in: TimeZone(identifier: "UTC")!, after: after)!
        let singapore = ScheduleEngine.nextOccurrence(rule, in: TimeZone(identifier: "Asia/Singapore")!, after: after)!
        XCTAssertNotEqual(utc, singapore)
    }

    func testEpochDayRoundTrips() {
        for day in [-800_000, -1, 0, 59, 60, 18_000, 2_932_896] {
            XCTAssertEqual(ScheduleEngine.epochDay(ScheduleEngine.fromEpochDay(day)), day)
        }
        XCTAssertEqual(ScheduleEngine.epochDay(LocalDate(year: 1970, month: 1, day: 1)), 0)
    }

    func testRepeatSummariesMatchAndroid() {
        let seven = LocalTime(hour: 7, minute: 0)
        XCTAssertEqual(RepeatSummary.summarize(.daily(seven), in: zone), "Every day at 7:00 AM")
        XCTAssertEqual(RepeatSummary.summarize(.weekdays(seven, isoWeekdays: [1, 2, 3, 4, 5]), in: zone), "Weekdays at 7:00 AM")
        XCTAssertEqual(RepeatSummary.summarize(.weekdays(LocalTime(hour: 21, minute: 5), isoWeekdays: [6, 1]), in: zone), "Mon, Sat at 9:05 PM")
        XCTAssertEqual(RepeatSummary.summarize(.yearly(LocalTime(hour: 0, minute: 0), month: 2, dayOfMonth: 29), in: zone), "Yearly on February 29 at 12:00 AM")
        XCTAssertEqual(RepeatSummary.summarize(.custom(seven, intervalDays: 3, anchorDate: LocalDate(year: 2026, month: 1, day: 1)), in: zone), "Every 3 days at 7:00 AM")
    }
}
