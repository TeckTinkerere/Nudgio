import Foundation

/// MR-08 wire shapes, field for field what `ReminderDtoWriter.kt` and
/// `MediaDtoWriter.kt` write, checked against `contract/fixtures/` by
/// `WireFixtureTests`.
extension NudgioKernel {
    func occurrenceWire(reminderId: String, at date: Date) -> WireMap {
        ["id": occurrenceId(reminderId, date), "reminderId": reminderId, "kind": "base",
         "scheduledAt": WireInstant.format(date), "state": "pending"]
    }

    func effectiveState(_ reminder: ReminderRecord) -> String {
        guard reminder.enabledIntent else { return "disabled" }
        return alarms.authorization == .authorized ? "active" : "needs_setup"
    }

    func summaryWire(_ reminder: ReminderRecord, in state: KernelState) -> WireMap {
        let media = reminder.mediaId.flatMap { id in state.media.first { $0.id == id } }
        let next = nextOccurrence(of: reminder, in: state)
        let missing = reminder.mediaId != nil && (media == nil || !fileExists(media!.storageKey, in: directories.media))
        return [
            "id": reminder.id,
            "label": reminder.label,
            "mediaId": wireNull(reminder.mediaId),
            "mediaKind": media?.kind.rawValue ?? "video",
            "thumbnailToken": wireNull(media.flatMap { thumbnailToken($0) }),
            "sourceToken": wireNull(media.map { sourceToken($0) }),
            "mediaMissing": missing,
            "profileId": reminder.profileId,
            "enabledIntent": reminder.enabledIntent,
            "effectiveState": effectiveState(reminder),
            "nextOccurrence": wireNull(next.map { occurrenceWire(reminderId: reminder.id, at: $0) }),
            "repeatSummary": RepeatSummary.summarize(reminder.schedule, in: zone),
            "schedule": reminder.schedule.wire,
            "action": wireNull(reminder.action?.wire),
            "notes": wireNull(reminder.notes),
            "skippedAt": wireNull(reminder.skippedAt.map(WireInstant.format)),
            "mediaStartMs": wireNull(reminder.mediaStartMs),
        ]
    }

    func detailWire(_ reminder: ReminderRecord, in state: KernelState) -> WireMap {
        var map = summaryWire(reminder, in: state)
        map["snooze"] = reminder.snooze.wire
        map["historyEnabled"] = reminder.historyEnabled
        map["createdAt"] = WireInstant.format(reminder.createdAt)
        map["updatedAt"] = WireInstant.format(reminder.updatedAt)
        map["entityVersion"] = reminder.entityVersion
        return map
    }

    func mediaSummaryWire(_ media: MediaRecord, in state: KernelState) -> WireMap {
        let attached = state.reminders.filter { $0.mediaId == media.id && $0.enabledIntent }.count
        return [
            "id": media.id,
            "kind": media.kind.rawValue,
            "title": media.title,
            "durationMs": wireNull(media.durationMs),
            "sizeBytes": String(media.sizeBytes),
            "thumbnailToken": wireNull(thumbnailToken(media)),
            "sourceToken": sourceToken(media),
            "widthPx": wireNull(media.widthPx),
            "heightPx": wireNull(media.heightPx),
            "category": NSNull(),
            "tags": [Any](),
            "activeReminderCount": attached,
            "integrity": fileExists(media.storageKey, in: directories.media) ? "healthy" : "missing",
            "createdAt": WireInstant.format(media.createdAt),
        ]
    }

    func mediaDetailWire(_ media: MediaRecord, in state: KernelState) -> WireMap {
        var map = mediaSummaryWire(media, in: state)
        map["notes"] = wireNull(media.notes)
        map["mimeType"] = media.mimeType
        map["updatedAt"] = WireInstant.format(media.updatedAt)
        map["entityVersion"] = media.entityVersion
        return map
    }

    /// Opaque to Dart: a `file://` URL into this app's own container, as on
    /// Android. Only Dart's media-token module may load it.
    func sourceToken(_ media: MediaRecord) -> String {
        directories.media.appendingPathComponent(media.storageKey).absoluteString
    }

    func thumbnailToken(_ media: MediaRecord) -> String? {
        guard let key = media.thumbnailKey, fileExists(key, in: directories.thumbnails) else { return nil }
        return directories.thumbnails.appendingPathComponent(key).absoluteString
    }

    func fileExists(_ key: String, in directory: URL) -> Bool {
        FileManager.default.fileExists(atPath: directory.appendingPathComponent(key).path)
    }
}
