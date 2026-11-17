import Foundation

/// What the kernel needs from iOS, as protocols, so the kernel is tested on
/// Linux against fakes and runs on an iPhone against AlarmKit and UIKit
/// (`Apple/`). Nothing here holds state the kernel does not also persist.

public enum AlarmAuthorization: String {
    case notDetermined, authorized, denied
}

/// One alarm the OS should hold, derived from a reminder by `reconcile`.
public struct PlannedAlarm: Equatable {
    public enum Schedule: Equatable {
        /// One moment: once, monthly, yearly, custom, or anything paused/skipped.
        case fixed(Date)
        /// AlarmKit's own weekly repeat: keeps firing with the app never opened.
        case weekly(LocalTime, isoWeekdays: [Int])
    }

    public enum Secondary: Equatable {
        /// AlarmKit countdown snooze, handled entirely by the system.
        case snooze(minutes: Int)
        /// "Open": stops the alert and opens the reminder's media (explicit Play).
        case open
    }

    /// The reminder's id; an alarm and its reminder share one UUID.
    public let id: String
    public let title: String
    public let schedule: Schedule
    public let secondary: Secondary

    /// Stable text for change detection: re-scheduling only when it differs.
    public var signature: String {
        let when: String
        switch schedule {
        case let .fixed(date): when = "fixed:\(Int(date.timeIntervalSince1970))"
        case let .weekly(time, days): when = "weekly:\(time.wire):\(days.map(String.init).joined(separator: ","))"
        }
        let action: String
        switch secondary {
        case let .snooze(minutes): action = "snooze:\(minutes)"
        case .open: action = "open"
        }
        return "\(when)|\(action)|\(title)"
    }
}

public protocol AlarmScheduling: AnyObject {
    var authorization: AlarmAuthorization { get }
    /// The one-shot system prompt (DL-108 primer: only when the user asks).
    func requestAuthorization() async -> AlarmAuthorization
    /// Registers [alarm], replacing any alarm with the same id.
    func apply(_ alarm: PlannedAlarm) async throws
    func cancel(id: String) async
    /// Silences a ringing alarm without touching its future repeats.
    func stop(id: String) async
    /// Starts the alarm's own countdown snooze, if it is ringing.
    func snooze(id: String) async
}

/// A file the picker copied into the kernel's staging directory. Only its
/// token crosses to Dart; never the path (MR-08).
public struct StagedFile: Equatable {
    public let url: URL
    public let displayName: String?
    public let mimeType: String
    public let sizeBytes: Int64?

    public init(url: URL, displayName: String?, mimeType: String, sizeBytes: Int64?) {
        self.url = url
        self.displayName = displayName
        self.mimeType = mimeType
        self.sizeBytes = sizeBytes
    }
}

public struct MediaProbe: Equatable {
    public var thumbnailJPEG: Data?
    public var widthPx: Int?
    public var heightPx: Int?
    public var durationMs: Int?

    public init(thumbnailJPEG: Data? = nil, widthPx: Int? = nil, heightPx: Int? = nil, durationMs: Int? = nil) {
        self.thumbnailJPEG = thumbnailJPEG
        self.widthPx = widthPx
        self.heightPx = heightPx
        self.durationMs = durationMs
    }
}

public protocol MediaPlatform: AnyObject {
    /// System pickers (PHPicker for visual media, the document picker
    /// otherwise), copied into [stagingDirectory]. Empty when backed out.
    func pick(mimeTypes: [String], maxItems: Int, stagingDirectory: URL) async -> [StagedFile]
    /// Thumbnail and dimensions; nil fields when the kind has none.
    func probe(file: URL, kind: MediaKind) async -> MediaProbe
    /// The share sheet; true once it is on screen.
    func share(files: [URL]) async -> Bool
    /// Add-only save to Photos (no read access requested).
    func saveToPhotos(file: URL, kind: MediaKind) async -> Bool
    /// The app's page in Settings.
    func openSettings() async -> Bool
}

/// No platform at all: Linux tests and any run without UIKit.
public final class UnavailablePlatform: MediaPlatform, AlarmScheduling {
    public private(set) var applied: [PlannedAlarm] = []
    public private(set) var cancelled: [String] = []
    public var authorization: AlarmAuthorization

    public init(authorization: AlarmAuthorization = .notDetermined) {
        self.authorization = authorization
    }

    public func requestAuthorization() async -> AlarmAuthorization { authorization }

    public func apply(_ alarm: PlannedAlarm) async throws {
        applied.removeAll { $0.id == alarm.id }
        applied.append(alarm)
    }

    public func cancel(id: String) async {
        cancelled.append(id)
        applied.removeAll { $0.id == id }
    }

    public func stop(id: String) async {}
    public func snooze(id: String) async {}
    public func pick(mimeTypes: [String], maxItems: Int, stagingDirectory: URL) async -> [StagedFile] { [] }
    public func probe(file: URL, kind: MediaKind) async -> MediaProbe { MediaProbe() }
    public func share(files: [URL]) async -> Bool { false }
    public func saveToPhotos(file: URL, kind: MediaKind) async -> Bool { false }
    public func openSettings() async -> Bool { false }
}
