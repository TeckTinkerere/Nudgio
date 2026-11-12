import Foundation

/// The `nudgio/host` method channel, iPhone side: the Swift twin of
/// `NudgioHostChannel.kt`. Takes a method name and the argument map Dart sent,
/// answers with a codec value or throws a `HostError`, whose `envelope` the
/// Runner passes back as `FlutterError.details`.
///
/// `DispatcherContractTests` checks [methods] against
/// `contract/host_methods.json`, so the three sides cannot drift.
public final class HostDispatcher {
    public static let contractVersion = 1
    public static let hostChannel = "nudgio/host"
    public static let eventChannel = "nudgio/events"

    public let kernel: NudgioKernel

    public init(kernel: NudgioKernel) {
        self.kernel = kernel
    }

    public static let methods: [String] = [
        "libraryCommand", "getStartupSnapshot", "getCapabilitySnapshot", "getPreferences", "setPreferences",
        "getDynamicColorScheme", "listMedia", "getMedia", "listProfiles", "pickDocument", "pickDocuments",
        "pickAlarmRingtone", "previewAlarmRingtone", "stopAlarmRingtonePreview", "listReminders", "getReminder",
        "saveReminder", "setReminderEnabled", "skipNextOccurrence", "setPausedUntil", "takeSharedDocuments",
        "deleteReminder", "scheduleTestReminder", "listRecentlyMissed", "playDueSession", "snoozeDueSession",
        "dismissDueSession", "beginExport", "shareBackupExport", "inspectBackup", "commitImport", "cancelOperation",
        "beginMediaImport", "updateMedia", "deleteMedia", "exportMediaAssets", "shareLibrarySelection",
        "saveLibrarySelectionToGallery", "replaceMediaSource", "saveMediaCopyToGallery", "getMediaStorageUsage",
        "requestNotificationPermission", "saveProfile", "resetBuiltInProfile", "openCapabilitySettings",
        "takePendingMediaOpen", "getStatistics",
    ]

    /// Answers one call. `nil` results come back as `NSNull`.
    public func handle(method: String, arguments: Any?) async throws -> Any {
        let args = WireReader(arguments)
        func required(_ key: String) throws -> String {
            guard let value = args.string(key), !value.isEmpty else { throw HostError.validation(key) }
            return value
        }

        switch method {
        case "getStartupSnapshot": return try await kernel.startupSnapshot()
        case "getCapabilitySnapshot": return await kernel.capabilitySnapshot()
        case "getPreferences": return try await kernel.preferences()
        case "setPreferences": return try await kernel.setPreferences(args.map("patch") ?? WireReader(nil))
        case "setPausedUntil":
            let until = args.string("until")
            guard until == nil || WireInstant.parse(until) != nil else { throw HostError.validation("until") }
            return try await kernel.setPausedUntil(WireInstant.parse(until))
        // Material You is Android's; the brand palette is used on iPhone.
        case "getDynamicColorScheme": return NSNull()
        case "listProfiles": return await kernel.profiles()
        case "getStatistics": return try await kernel.statistics(rangeDays: args.int("rangeDays") ?? 30)
        case "requestNotificationPermission": return await kernel.requestAlarmAuthorization()
        case "openCapabilitySettings":
            return await kernel.openSettings()

        case "listReminders": return try await kernel.listReminders()
        case "getReminder": return try await kernel.reminder(required("id"))
        case "saveReminder": return try await kernel.saveReminder(args.map("request") ?? WireReader(nil))
        case "setReminderEnabled":
            guard let enabled = args.bool("enabled") else { throw HostError.validation("enabled") }
            return try await kernel.setEnabled(required("id"), enabled)
        case "skipNextOccurrence":
            guard let skip = args.bool("skip") else { throw HostError.validation("skip") }
            return try await kernel.skipNext(required("id"), skip)
        case "deleteReminder": return try await kernel.deleteReminder(required("id"))
        case "takePendingMediaOpen": return try await kernel.takePendingOpen()
        // The system records nothing Nudgio can read about unanswered alarms
        // (DL-122), so iPhone has no "missed" list yet.
        case "listRecentlyMissed": return [Any]()
        case "playDueSession": return try await kernel.resolveDue(action: "play", sessionId: required("sessionId"), snoozeMinutes: nil)
        case "snoozeDueSession":
            return try await kernel.resolveDue(action: "snooze", sessionId: required("sessionId"), snoozeMinutes: args.int("minutes"))
        case "dismissDueSession": return try await kernel.resolveDue(action: "dismiss", sessionId: required("sessionId"), snoozeMinutes: nil)
        case "scheduleTestReminder":
            // Settings' "Preview alarm styles" is about Android's full-screen
            // vs notification styles; iPhone has one system alarm style.
            throw HostError.notImplemented(method)

        case "libraryCommand": return try await kernel.libraryCommand(required("requestJson"))
        case "listMedia": return try await kernel.listMedia(args.map("query") ?? WireReader(nil))
        case "getMedia": return try await kernel.media(required("id"))
        case "updateMedia": return try await kernel.updateMedia(args.map("request") ?? WireReader(nil))
        case "deleteMedia": return try await kernel.deleteMedia(args.map("request") ?? WireReader(nil))
        case "getMediaStorageUsage": return try await kernel.storageUsage()
        case "exportMediaAssets": return try await kernel.share(mediaIds: args.strings("ids") ?? [], folderIds: [])
        case "shareLibrarySelection":
            return try await kernel.share(mediaIds: args.strings("mediaIds") ?? [], folderIds: args.strings("folderIds") ?? [])
        case "saveLibrarySelectionToGallery":
            return try await kernel.saveSelectionToPhotos(mediaIds: args.strings("mediaIds") ?? [], folderIds: args.strings("folderIds") ?? [])
        case "saveMediaCopyToGallery": return try await kernel.saveCopyToPhotos(required("id"))
        case "pickDocument":
            let picked = await kernel.pick(mimeTypes: args.strings("mimeTypes") ?? [], maxItems: 1)
            return picked.first ?? NSNull()
        case "pickDocuments":
            return await kernel.pick(mimeTypes: args.strings("mimeTypes") ?? [], maxItems: args.int("maxItems") ?? 1)
        // A share extension is a later slice; nothing arrives this way yet.
        case "takeSharedDocuments": return [Any]()
        case "beginMediaImport": return try await kernel.importMedia(args.map("request") ?? WireReader(nil))
        case "replaceMediaSource":
            let request = args.map("request") ?? WireReader(nil)
            guard let mediaId = request.string("mediaId"), !mediaId.isEmpty else { throw HostError.validation("mediaId") }
            return try await kernel.importMedia(request, replacing: mediaId)
        case "cancelOperation": return try await kernel.cancelOperation(required("id"))

        // iPhone alarms use the system alarm sound (plan F7): no picker, no preview.
        case "pickAlarmRingtone": return NSNull()
        case "previewAlarmRingtone": return ["status": "limited", "affectedCount": 0]
        case "stopAlarmRingtonePreview": return ["status": "ok", "affectedCount": 0]

        // Backup and Android → iPhone transfer are the next iPhone slice (DL-122).
        case "beginExport", "shareBackupExport", "inspectBackup", "commitImport", "saveProfile", "resetBuiltInProfile":
            throw HostError.notImplemented(method)

        default:
            throw HostError(code: "MR_INTERNAL_FAILED_SAFE", messageKey: "error.unexpected", category: .internal, field: method)
        }
    }
}
