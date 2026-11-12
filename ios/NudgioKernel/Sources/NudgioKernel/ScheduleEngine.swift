import Foundation

/// Next-occurrence calculation, ported from `OccurrenceCalculator.kt` so both
/// phones agree on when a rule fires, including across DST.
///
/// Zone resolution follows `java.time`'s `LocalDateTime.atZone`, which the
/// Android tests pin down: a wall-clock time inside a spring-forward gap moves
/// later by the gap's length; a time inside a fall-back overlap takes the
/// earlier instant unless `preferLaterOnOverlap`.
public enum ScheduleEngine {
    private static let maxIterations = 1000

    public static func nextOccurrence(
        _ rule: ScheduleRule,
        in zone: TimeZone,
        after: Date,
        preferLaterOnOverlap: Bool = false
    ) -> Date? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let start = localDate(of: after, calendar: calendar)
        func resolve(_ date: LocalDate, _ time: LocalTime) -> Date {
            resolveLocal(date, time, in: zone, preferLaterOnOverlap: preferLaterOnOverlap)
        }

        switch rule {
        case let .once(instant, _):
            return instant > after ? instant : nil

        case let .daily(time):
            var date = start
            for _ in 0..<maxIterations {
                let candidate = resolve(date, time)
                if candidate > after { return candidate }
                date = adding(days: 1, to: date)
            }

        case let .weekdays(time, days):
            guard !days.isEmpty else { return nil }
            var date = start
            for _ in 0..<maxIterations {
                if days.contains(isoWeekday(of: date)) {
                    let candidate = resolve(date, time)
                    if candidate > after { return candidate }
                }
                date = adding(days: 1, to: date)
            }

        case let .monthly(time, day):
            var (year, month) = (start.year, start.month)
            for _ in 0..<maxIterations {
                let candidate = resolve(clamped(year: year, month: month, day: day), time)
                if candidate > after { return candidate }
                month += 1
                if month > 12 { month = 1; year += 1 }
            }

        case let .yearly(time, month, day):
            var year = start.year
            for _ in 0..<maxIterations {
                let candidate = resolve(clamped(year: year, month: month, day: day), time)
                if candidate > after { return candidate }
                year += 1
            }

        case let .custom(time, interval, anchor):
            guard interval >= 1 else { return nil }
            let elapsed = daysBetween(anchor, start)
            let cycles = elapsed <= 0 ? 0 : (elapsed + interval - 1) / interval
            var date = adding(days: cycles * interval, to: anchor)
            for _ in 0..<maxIterations {
                let candidate = resolve(date, time)
                if candidate > after { return candidate }
                date = adding(days: interval, to: date)
            }
        }
        return nil
    }

    /// `java.time`-compatible local → instant resolution (see the type doc).
    public static func resolveLocal(_ date: LocalDate, _ time: LocalTime, in zone: TimeZone, preferLaterOnOverlap: Bool = false) -> Date {
        let local = TimeInterval(epochDay(date) * 86_400 + time.hour * 3600 + time.minute * 60 + time.second)
        // Offsets a day either side bracket any single transition near `local`.
        let before = zone.secondsFromGMT(for: Date(timeIntervalSince1970: local - 86_400))
        let after = zone.secondsFromGMT(for: Date(timeIntervalSince1970: local + 86_400))
        let early = Date(timeIntervalSince1970: local - TimeInterval(before))
        if before == after { return early }
        let late = Date(timeIntervalSince1970: local - TimeInterval(after))
        let earlyValid = zone.secondsFromGMT(for: early) == before
        let lateValid = zone.secondsFromGMT(for: late) == after
        switch (earlyValid, lateValid) {
        case (true, true):
            // Overlap: the wall clock happens twice.
            return preferLaterOnOverlap ? max(early, late) : min(early, late)
        case (true, false): return early
        case (false, true): return late
        case (false, false):
            // Gap: shift later by the gap, i.e. use the offset from before it.
            return early
        }
    }

    public static func localDate(of date: Date, calendar: Calendar) -> LocalDate {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return LocalDate(year: parts.year!, month: parts.month!, day: parts.day!)
    }

    /// ISO weekday, Monday = 1.
    public static func isoWeekday(of date: LocalDate) -> Int {
        // 1970-01-01 was a Thursday (ISO 4).
        let weekday = (epochDay(date) + 3) % 7
        return (weekday < 0 ? weekday + 7 : weekday) + 1
    }

    static func clamped(year: Int, month: Int, day: Int) -> LocalDate {
        LocalDate(year: year, month: month, day: min(day, daysIn(year: year, month: month)))
    }

    static func daysIn(year: Int, month: Int) -> Int {
        switch month {
        case 2: return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 ? 29 : 28
        case 4, 6, 9, 11: return 30
        default: return 31
        }
    }

    static func adding(days: Int, to date: LocalDate) -> LocalDate {
        fromEpochDay(epochDay(date) + days)
    }

    static func daysBetween(_ from: LocalDate, _ to: LocalDate) -> Int {
        epochDay(to) - epochDay(from)
    }

    /// Days since 1970-01-01 (proleptic Gregorian), as `LocalDate.toEpochDay`.
    static func epochDay(_ date: LocalDate) -> Int {
        let y = date.month <= 2 ? date.year - 1 : date.year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (date.month + 9) % 12
        let doy = (153 * mp + 2) / 5 + date.day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    static func fromEpochDay(_ day: Int) -> LocalDate {
        let z = day + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return LocalDate(year: yoe + era * 400 + (m <= 2 ? 1 : 0), month: m, day: d)
    }
}

/// Plain-language repeat summaries, as `RepeatSummaryFormatter.kt` writes
/// them (MR-13: rendered text, already localized; English for now on both).
public enum RepeatSummary {
    private static let weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private static let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August",
                                     "September", "October", "November", "December"]

    public static func summarize(_ rule: ScheduleRule, in zone: TimeZone) -> String {
        switch rule {
        case let .once(instant, _):
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = zone
            formatter.dateFormat = "EEE d MMM 'at' h:mm a"
            return "Once on \(formatter.string(from: instant))"
        case let .daily(time):
            return "Every day at \(format(time))"
        case let .weekdays(time, days):
            return "\(weekdayList(days)) at \(format(time))"
        case let .monthly(time, day):
            return "Monthly on day \(day) at \(format(time))"
        case let .yearly(time, month, day):
            return "Yearly on \(monthNames[month - 1]) \(day) at \(format(time))"
        case let .custom(time, interval, _):
            return "Every \(interval) days at \(format(time))"
        }
    }

    static func format(_ time: LocalTime) -> String {
        let hour12 = time.hour % 12 == 0 ? 12 : time.hour % 12
        // Interpolated, not `%@`: a Swift String is not a C vararg on Linux.
        return "\(hour12):\(String(format: "%02d", time.minute)) \(time.hour < 12 ? "AM" : "PM")"
    }

    static func weekdayList(_ days: [Int]) -> String {
        let sorted = days.sorted()
        if sorted == [1, 2, 3, 4, 5] { return "Weekdays" }
        if sorted == [6, 7] { return "Weekends" }
        if sorted == [1, 2, 3, 4, 5, 6, 7] { return "Every day" }
        return sorted.map { weekdayNames[$0 - 1] }.joined(separator: ", ")
    }
}
