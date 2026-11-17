import Foundation

/// A wall-clock time, `HH:mm:ss` on the wire.
public struct LocalTime: Codable, Equatable, Hashable {
    public var hour: Int
    public var minute: Int
    public var second: Int

    public init(hour: Int, minute: Int, second: Int = 0) {
        self.hour = hour
        self.minute = minute
        self.second = second
    }

    public init?(wire: String?) {
        guard let parts = wire?.split(separator: ":").compactMap({ Int($0) }), (2...3).contains(parts.count) else { return nil }
        let second = parts.count == 3 ? parts[2] : 0
        guard (0...23).contains(parts[0]), (0...59).contains(parts[1]), (0...59).contains(second) else { return nil }
        self.init(hour: parts[0], minute: parts[1], second: second)
    }

    public var wire: String { String(format: "%02d:%02d:%02d", hour, minute, second) }
}

/// A calendar date, `YYYY-MM-DD` on the wire.
public struct LocalDate: Codable, Equatable, Hashable, Comparable {
    public var year: Int
    public var month: Int
    public var day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    public init?(wire: String?) {
        guard let parts = wire?.split(separator: "-").compactMap({ Int($0) }), parts.count == 3,
              (1...12).contains(parts[1]), (1...31).contains(parts[2]) else { return nil }
        self.init(year: parts[0], month: parts[1], day: parts[2])
    }

    public var wire: String { String(format: "%04d-%02d-%02d", year, month, day) }

    public static func < (lhs: LocalDate, rhs: LocalDate) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }
}

/// MR-08's six schedule rules. Every time is the local wall clock the user
/// picked; the zone is resolved once, in `ScheduleEngine`.
public enum ScheduleRule: Codable, Equatable {
    case once(instant: Date, originZone: String)
    case daily(LocalTime)
    case weekdays(LocalTime, isoWeekdays: [Int])
    case monthly(LocalTime, dayOfMonth: Int)
    case yearly(LocalTime, month: Int, dayOfMonth: Int)
    case custom(LocalTime, intervalDays: Int, anchorDate: LocalDate)

    /// Mirrors `ScheduleRuleBridge.readRule`: nil for anything it would reject.
    public init?(wire: WireReader) {
        let time = LocalTime(wire: wire.string("localTime"))
        switch wire.string("type") {
        case "once":
            guard let instant = WireInstant.parse(wire.string("instant")) else { return nil }
            self = .once(instant: instant, originZone: wire.string("originZone") ?? "UTC")
        case "daily":
            guard let time else { return nil }
            self = .daily(time)
        case "weekdays":
            guard let time, let days = wire.ints("isoWeekdays"), !days.isEmpty, days.allSatisfy({ (1...7).contains($0) })
            else { return nil }
            self = .weekdays(time, isoWeekdays: Array(Set(days)).sorted())
        case "monthly":
            guard let time, let day = wire.int("dayOfMonth"), (1...31).contains(day) else { return nil }
            self = .monthly(time, dayOfMonth: day)
        case "yearly":
            guard let time, let month = wire.int("month"), (1...12).contains(month),
                  let day = wire.int("dayOfMonth"), (1...31).contains(day) else { return nil }
            self = .yearly(time, month: month, dayOfMonth: day)
        case "custom":
            guard let time, let interval = wire.int("intervalDays"), interval >= 1,
                  let anchor = LocalDate(wire: wire.string("anchorDate")) else { return nil }
            self = .custom(time, intervalDays: interval, anchorDate: anchor)
        default:
            return nil
        }
    }

    public var isRepeating: Bool {
        if case .once = self { return false }
        return true
    }

    public var wire: WireMap {
        switch self {
        case let .once(instant, zone):
            return ["type": "once", "instant": WireInstant.format(instant), "originZone": zone]
        case let .daily(time):
            return ["type": "daily", "localTime": time.wire, "zonePolicy": "follow_device"]
        case let .weekdays(time, days):
            return ["type": "weekdays", "localTime": time.wire, "isoWeekdays": days, "zonePolicy": "follow_device"]
        case let .monthly(time, day):
            return ["type": "monthly", "localTime": time.wire, "dayOfMonth": day, "zonePolicy": "follow_device"]
        case let .yearly(time, month, day):
            return ["type": "yearly", "localTime": time.wire, "month": month, "dayOfMonth": day, "zonePolicy": "follow_device"]
        case let .custom(time, interval, anchor):
            return ["type": "custom", "localTime": time.wire, "intervalDays": interval, "anchorDate": anchor.wire,
                    "zonePolicy": "follow_device"]
        }
    }
}

public struct SnoozePolicy: Codable, Equatable {
    public var defaultMinutes: Int
    public var allowCustom: Bool
    public var minimumMinutes: Int
    public var maximumMinutes: Int

    var wire: WireMap {
        ["defaultMinutes": defaultMinutes, "allowCustom": allowCustom, "minimumMinutes": minimumMinutes,
         "maximumMinutes": maximumMinutes]
    }
}

public struct ReminderAction: Codable, Equatable {
    public var uri: String
    public var label: String?

    var wire: WireMap { ["type": "open_link", "uri": uri, "label": wireNull(label)] }
}

public struct ReminderRecord: Codable, Equatable {
    public var id: String
    public var mediaId: String?
    public var profileId: String
    public var label: String
    public var notes: String?
    public var enabledIntent: Bool
    public var schedule: ScheduleRule
    public var snooze: SnoozePolicy
    public var historyEnabled: Bool
    public var action: ReminderAction?
    public var mediaStartMs: Int?
    /// DL-110 "Skip next": the occurrence passed over, while still ahead.
    public var skippedAt: Date?
    public var createdAt: Date
    public var updatedAt: Date
    public var entityVersion: Int
}

/// What happened to one due moment, for Statistics and history.
public struct OccurrenceRecord: Codable, Equatable {
    public enum State: String, Codable { case pending, accepted, snoozed, dismissed, missed }

    public var id: String
    public var reminderId: String
    public var scheduledAt: Date
    public var state: State
}

public enum MediaKind: String, Codable, CaseIterable { case video, audio, image, text }

public struct MediaRecord: Codable, Equatable {
    public var id: String
    public var kind: MediaKind
    public var title: String
    public var notes: String?
    public var mimeType: String
    public var sizeBytes: Int64
    public var sha256: String
    /// File name inside the media directory. Never sent to Dart (MR-08).
    public var storageKey: String
    public var thumbnailKey: String?
    public var durationMs: Int?
    public var widthPx: Int?
    public var heightPx: Int?
    public var createdAt: Date
    public var updatedAt: Date
    public var entityVersion: Int
}

public struct FolderRecord: Codable, Equatable {
    public var id: String
    public var parentId: String?
    public var name: String
    public var pinned: Bool
}

public struct Preferences: Codable, Equatable {
    public var themePreference = "system"
    public var useMaterialYou = false
    public var use24HourTime: Bool?
    public var languageTag: String?
    public var hasCompletedOnboarding = false
    public var defaultSnoozeMinutes = 10
    /// Not part of a backup: a pause is about this phone this week (DL-110).
    public var pausedUntil: Date?

    public init() {}
}

/// "Until I resume", as Kotlin's `PreferencesRepository.INDEFINITE_PAUSE`.
public let indefinitePause = Date(timeIntervalSince1970: 253_402_300_799) // 9999-12-31T23:59:59Z

/// Everything the kernel persists, in one versioned document (DL-122).
public struct KernelState: Codable, Equatable {
    public static let currentSchemaVersion = 1

    public var schemaVersion = KernelState.currentSchemaVersion
    public var reminders: [ReminderRecord] = []
    public var occurrences: [OccurrenceRecord] = []
    public var media: [MediaRecord] = []
    public var folders: [FolderRecord] = []
    /// mediaId → folderId. One home per item.
    public var memberships: [String: String] = [:]
    public var libraryRevision = 0
    public var libraryUndo: LibraryUndo?
    public var libraryReceipts: [CommandReceipt] = []
    public var preferences = Preferences()
    /// The alarms last handed to the OS, by reminder id: what `reconcile` diffs against.
    public var scheduledAlarms: [String: String] = [:]
    /// One-slot "Play/Open asked to show this" handoff (`takePendingMediaOpen`).
    public var pendingOpen: PendingOpen?

    public init() {}
}

public struct PendingOpen: Codable, Equatable {
    public var reminderId: String?
    public var mediaId: String?
}

public struct CommandReceipt: Codable, Equatable {
    public var id: String
    public var at: Date
}

public struct LibraryUndo: Codable, Equatable {
    public struct Row: Codable, Equatable {
        public var id: String
        public var folder: String?
        public var version: Int
    }

    public var at: Date
    public var rows: [Row]
}

/// Built-in profiles, with the same ids and values as `ReminderProfileSeed.kt`
/// so a backup moves between phones without remapping.
public struct ReminderProfile: Equatable {
    public let id: String
    public let nameKey: String
    public let fullScreenWhenLocked: Bool
    public let timeoutSeconds: Int
    public let retryCount: Int
    public let graceSeconds: Int
    public let defaultSnoozeMinutes: Int

    public static let builtIn: [ReminderProfile] = [
        .init(id: "00000000-0000-4000-8000-000000000001", nameKey: "profile.gentle.name", fullScreenWhenLocked: false,
              timeoutSeconds: 60, retryCount: 0, graceSeconds: 300, defaultSnoozeMinutes: 10),
        .init(id: "00000000-0000-4000-8000-000000000002", nameKey: "profile.standard.name", fullScreenWhenLocked: true,
              timeoutSeconds: 300, retryCount: 1, graceSeconds: 600, defaultSnoozeMinutes: 10),
        .init(id: "00000000-0000-4000-8000-000000000003", nameKey: "profile.persistent.name", fullScreenWhenLocked: true,
              timeoutSeconds: 600, retryCount: 3, graceSeconds: 900, defaultSnoozeMinutes: 5),
    ]

    var wire: WireMap {
        ["id": id, "nameKey": nameKey, "isBuiltIn": true, "fullScreenWhenLocked": fullScreenWhenLocked,
         "timeoutSeconds": timeoutSeconds, "retryCount": retryCount, "graceSeconds": graceSeconds,
         "defaultSnoozeMinutes": defaultSnoozeMinutes, "entityVersion": 1]
    }
}
