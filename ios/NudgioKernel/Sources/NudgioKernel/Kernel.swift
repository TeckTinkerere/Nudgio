import Foundation

public struct KernelDirectories {
    /// Application Support/Nudgio: the state document, media and thumbnails.
    public let root: URL
    /// Caches/staging: picked files waiting for `beginMediaImport`.
    public let staging: URL

    public init(root: URL, staging: URL) {
        self.root = root
        self.staging = staging
    }

    public var media: URL { root.appendingPathComponent("media", isDirectory: true) }
    public var thumbnails: URL { root.appendingPathComponent("thumbnails", isDirectory: true) }
}

public struct KernelEnvironment {
    public var appVersion: String
    public var buildVariant: String
    public var now: () -> Date
    public var zone: () -> TimeZone

    public init(appVersion: String, buildVariant: String, now: @escaping () -> Date = Date.init,
                zone: @escaping () -> TimeZone = { TimeZone.current }) {
        self.appVersion = appVersion
        self.buildVariant = buildVariant
        self.now = now
        self.zone = zone
    }
}

/// `{event, payload}` to Dart's `nudgio/events`; a no-op with no listener.
public typealias HostEventSink = @Sendable (_ event: String, _ payload: WireMap) -> Void

/// Cooperative cancellation for long operations (`cancelOperation`), shared
/// across isolation domains, like Kotlin's `OperationRegistry`.
final class OperationRegistry: @unchecked Sendable {
    private let lock = NSLock()
    private var cancelled: Set<String> = []

    func cancel(_ id: String) { lock.lock(); cancelled.insert(id); lock.unlock() }
    func isCancelled(_ id: String) -> Bool { lock.lock(); defer { lock.unlock() }; return cancelled.contains(id) }
    func clear(_ id: String) { lock.lock(); cancelled.remove(id); lock.unlock() }
}

/// The iPhone reliability core: owns `KernelState`, applies every mutation,
/// and keeps AlarmKit's registrations equal to what the state says should
/// ring (`reconcile`). An actor, so host calls are serialized the way Room
/// transactions serialize them on Android; long file copies run off-actor.
///
/// Differences from Android that are deliberate (plan §5, F7):
///  - no one-earliest-alarm scheduler: AlarmKit holds one alarm per enabled
///    reminder, capped at [maxEnabledReminders] until G1-09 measures the limit;
///  - daily and weekday rules use AlarmKit's own weekly repeat; monthly,
///    yearly and custom rules hold their next moment and are re-armed whenever
///    the app runs (launch, foreground, an alarm's Open);
///  - an alarm's second button is Open when it has media, Snooze otherwise
///    (AlarmKit allows one); Stop is always the system's.
public actor NudgioKernel {
    public static let maxEnabledReminders = 20
    static let maxNotesLength = 4000
    static let maxMediaStartMs = 6 * 60 * 60 * 1000

    let store: KernelStore
    public let directories: KernelDirectories
    let alarms: AlarmScheduling
    let platform: MediaPlatform
    let environment: KernelEnvironment
    let events: HostEventSink
    let operations = OperationRegistry()
    private var cached: KernelState?
    private var schedulerGeneration = 0

    public init(store: KernelStore, directories: KernelDirectories, alarms: AlarmScheduling, platform: MediaPlatform,
                environment: KernelEnvironment, events: @escaping HostEventSink = { _, _ in }) {
        self.store = store
        self.directories = directories
        self.alarms = alarms
        self.platform = platform
        self.environment = environment
        self.events = events
    }

    // MARK: State

    func state() throws -> KernelState {
        if let cached { return cached }
        let loaded = try store.load()
        cached = loaded
        return loaded
    }

    func commit(_ state: KernelState) throws {
        try store.save(state)
        cached = state
    }

    var now: Date { environment.now() }
    var zone: TimeZone { environment.zone() }

    // MARK: Startup, capability, preferences

    public func startupSnapshot() async throws -> WireMap {
        await reconcile()
        let state = try state()
        let enabled = state.reminders.filter(\.enabledIntent)
        let next = enabled.compactMap { reminder in nextOccurrence(of: reminder, in: state).map { (reminder, $0) } }
            .min { $0.1 < $1.1 }
        return [
            "contractVersion": HostDispatcher.contractVersion,
            "schemaVersion": KernelState.currentSchemaVersion,
            "appVersion": environment.appVersion,
            "buildVariant": environment.buildVariant,
            "platform": "ios",
            "mediaCount": state.media.count,
            "activeReminderCount": enabled.count,
            "nextOccurrence": wireNull(next.map { occurrenceWire(reminderId: $0.0.id, at: $0.1) }),
            "capability": capabilitySnapshot(),
            "repair": ["inProgress": false, "pendingOperations": 0],
            "activeSession": NSNull(),
            "sequence": "1",
        ]
    }

    public func capabilitySnapshot() -> WireMap {
        let observedAt = WireInstant.format(now)
        let (status, action, overall): (String, String, String)
        switch alarms.authorization {
        case .authorized: (status, action, overall) = ("ready", "none", "ok")
        case .notDetermined: (status, action, overall) = ("unknown", "request_runtime", "needs_action")
        case .denied: (status, action, overall) = ("blocked", "open_app", "needs_action")
        }
        let item: WireMap = [
            "kind": "alarm_authorization",
            "status": status,
            "effectKey": "capability.alarmAuthorization.\(status)",
            "action": action,
            "observedAt": observedAt,
        ]
        return ["overall": overall, "items": [item], "observedAt": observedAt]
    }

    /// The primer's "Allow" (Dart calls this method name on both phones). On
    /// iPhone the permission alarms need is AlarmKit's, not notifications'.
    public func requestAlarmAuthorization() async -> WireMap {
        let granted = await alarms.requestAuthorization() == .authorized
        if granted { await reconcile() }
        return ["granted": granted]
    }

    public func preferences() throws -> WireMap {
        preferencesWire(try state().preferences)
    }

    func preferencesWire(_ prefs: Preferences) -> WireMap {
        let pause = prefs.pausedUntil.flatMap { $0 > now ? $0 : nil }
        return [
            "themePreference": prefs.themePreference,
            "useMaterialYou": prefs.useMaterialYou,
            "use24HourTime": wireNull(prefs.use24HourTime),
            "languageTag": wireNull(prefs.languageTag),
            "hasCompletedOnboarding": prefs.hasCompletedOnboarding,
            "defaultSnoozeMinutes": prefs.defaultSnoozeMinutes,
            // iPhone alarms use the system alarm sound (plan F7).
            "alarmRingtoneUri": NSNull(),
            "alarmRingtoneTitle": "System alarm",
            "pausedUntil": wireNull(pause.map(WireInstant.format)),
        ]
    }

    /// Applies only the keys present, as `PreferencesRepository.write`.
    public func setPreferences(_ patch: WireReader) throws -> WireMap {
        var state = try state()
        var prefs = state.preferences
        if patch.has("themePreference") {
            guard let theme = patch.string("themePreference"), ["system", "light", "dark"].contains(theme) else {
                throw HostError.validation("themePreference")
            }
            prefs.themePreference = theme
        }
        if let value = patch.bool("useMaterialYou") { prefs.useMaterialYou = value }
        if patch.values.keys.contains("use24HourTime") { prefs.use24HourTime = patch.bool("use24HourTime") }
        if patch.values.keys.contains("languageTag") { prefs.languageTag = patch.string("languageTag") }
        if let value = patch.bool("hasCompletedOnboarding") { prefs.hasCompletedOnboarding = value }
        if patch.has("defaultSnoozeMinutes") {
            guard let minutes = patch.int("defaultSnoozeMinutes"), (1...60).contains(minutes) else {
                throw HostError.validation("defaultSnoozeMinutes")
            }
            prefs.defaultSnoozeMinutes = minutes
        }
        state.preferences = prefs
        try commit(state)
        return preferencesWire(prefs)
    }

    /// DL-110 "Pause all": a past instant resumes. Re-arms everything from the end.
    public func setPausedUntil(_ until: Date?) async throws -> WireMap {
        var state = try state()
        state.preferences.pausedUntil = until.flatMap { $0 > now ? $0 : nil }
        try commit(state)
        await reconcile()
        return preferencesWire(state.preferences)
    }

    /// The app's page in Settings: where AlarmKit access is changed after a "Don't Allow".
    public func openSettings() async -> WireMap {
        _ = await platform.openSettings()
        return [:]
    }

    public func profiles() -> [Any] {
        ReminderProfile.builtIn.map(\.wire)
    }

    // MARK: Reminders

    public func listReminders() throws -> WireMap {
        let state = try state()
        let items = state.reminders.sorted { $0.createdAt < $1.createdAt }.map { summaryWire($0, in: state) }
        return ["items": items, "total": items.count, "offset": 0, "hasMore": false]
    }

    public func reminder(_ id: String) throws -> WireMap {
        let state = try state()
        guard let reminder = state.reminders.first(where: { $0.id == id }) else { throw HostError.unknownId() }
        return detailWire(reminder, in: state)
    }

    /// `saveReminder`, with the validation order and field names of
    /// `ReminderMutationService.save`.
    public func saveReminder(_ request: WireReader) async throws -> WireMap {
        var state = try state()
        let mediaId = request.string("mediaId")?.trimmingCharacters(in: .whitespaces).nonEmpty
        guard let label = request.string("label")?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty else {
            throw HostError.validation("label", messageKey: "error.unexpected")
        }
        guard let profileId = request.string("profileId"), ReminderProfile.builtIn.contains(where: { $0.id == profileId }) else {
            throw HostError.validation("profileId", messageKey: "error.unexpected")
        }
        guard let scheduleWire = request.map("schedule"), let schedule = ScheduleRule(wire: scheduleWire) else {
            throw HostError.validation("schedule", messageKey: "error.unexpected")
        }
        guard let snoozeWire = request.map("snooze"), let defaultMinutes = snoozeWire.int("defaultMinutes"),
              let minimum = snoozeWire.int("minimumMinutes"), let maximum = snoozeWire.int("maximumMinutes") else {
            throw HostError.validation("snooze", messageKey: "error.unexpected")
        }
        let enabledIntent = request.bool("enabledIntent") ?? true
        let notes = request.string("notes")?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
        if let notes, notes.count > Self.maxNotesLength { throw HostError.validation("notes", messageKey: "error.unexpected") }
        var mediaStartMs: Int?
        if request.has("mediaStartMs") {
            guard let start = request.int("mediaStartMs"), (0...Self.maxMediaStartMs).contains(start) else {
                throw HostError.validation("mediaStartMs", messageKey: "error.unexpected")
            }
            mediaStartMs = start > 0 ? start : nil
        }
        let actionWire = request.map("action")
        let action: ReminderAction?
        switch ActionRules.validate(type: actionWire?.string("type"), uri: actionWire?.string("uri"), label: actionWire?.string("label")) {
        case let .invalid(field): throw HostError.validation(field, messageKey: "error.unexpected")
        case let .ok(resolved): action = resolved
        }
        let requestedId = request.string("id")
        let existingIndex = requestedId.flatMap { id in state.reminders.firstIndex { $0.id == id } }
        if requestedId != nil && existingIndex == nil { throw HostError.unknownId() }
        if let existingIndex, let version = request.int("entityVersion"), state.reminders[existingIndex].entityVersion != version {
            throw HostError.validation("entityVersion", messageKey: "error.unexpected", retryable: true)
        }
        let wasEnabled = existingIndex.map { state.reminders[$0].enabledIntent } ?? false
        if enabledIntent && !wasEnabled && state.reminders.filter(\.enabledIntent).count >= Self.maxEnabledReminders {
            throw HostError.validation("enabledLimit")
        }

        let existing = existingIndex.map { state.reminders[$0] }
        let record = ReminderRecord(
            id: existing?.id ?? requestedId ?? UUID().uuidString.lowercased(),
            mediaId: mediaId,
            profileId: profileId,
            label: label,
            notes: notes,
            enabledIntent: enabledIntent,
            schedule: schedule,
            snooze: SnoozePolicy(defaultMinutes: defaultMinutes, allowCustom: snoozeWire.bool("allowCustom") ?? true,
                                 minimumMinutes: minimum, maximumMinutes: maximum),
            historyEnabled: request.bool("historyEnabled") ?? existing?.historyEnabled ?? true,
            action: action,
            mediaStartMs: mediaId == nil ? nil : mediaStartMs,
            // An edited schedule makes an old skip meaningless, as on Android.
            skippedAt: nil,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            entityVersion: (existing?.entityVersion ?? 0) + 1
        )
        if let existingIndex { state.reminders[existingIndex] = record } else { state.reminders.append(record) }
        try commit(state)
        await reconcile()

        let saved = try self.state()
        let next = nextOccurrence(of: record, in: saved)
        let capability: WireMap = !enabledIntent || alarms.authorization == .authorized
            ? ["status": "ok"]
            : ["status": "needs_action", "effectKey": "capability.alarmAuthorization.required"]
        return [
            "reminder": detailWire(record, in: saved),
            "nextOccurrence": wireNull(next.map { occurrenceWire(reminderId: record.id, at: $0) }),
            "capabilityResult": capability,
            "schedulerGeneration": String(schedulerGeneration),
        ]
    }

    public func setEnabled(_ id: String, _ enabled: Bool) async throws -> WireMap {
        var state = try state()
        guard let index = state.reminders.firstIndex(where: { $0.id == id }) else { throw HostError.unknownId() }
        if enabled && !state.reminders[index].enabledIntent
            && state.reminders.filter(\.enabledIntent).count >= Self.maxEnabledReminders {
            throw HostError.validation("enabledLimit")
        }
        state.reminders[index].enabledIntent = enabled
        state.reminders[index].updatedAt = now
        state.reminders[index].entityVersion += 1
        if !enabled { state.reminders[index].skippedAt = nil }
        try commit(state)
        await reconcile()
        return try enableResult(id)
    }

    /// DL-110 "Skip next" (`skip: false` undoes it).
    public func skipNext(_ id: String, _ skip: Bool) async throws -> WireMap {
        var state = try state()
        guard let index = state.reminders.firstIndex(where: { $0.id == id }) else { throw HostError.unknownId() }
        if skip {
            guard state.reminders[index].schedule.isRepeating else { throw HostError.validation("notRepeating") }
            guard let next = nextOccurrence(of: state.reminders[index], in: state) else { throw HostError.validation("nothingPending") }
            state.reminders[index].skippedAt = next
        } else {
            state.reminders[index].skippedAt = nil
        }
        try commit(state)
        await reconcile()
        return try enableResult(id)
    }

    func enableResult(_ id: String) throws -> WireMap {
        let state = try state()
        guard let reminder = state.reminders.first(where: { $0.id == id }) else { throw HostError.unknownId() }
        let next = nextOccurrence(of: reminder, in: state)
        return [
            "reminder": summaryWire(reminder, in: state),
            "nextOccurrence": wireNull(next.map { occurrenceWire(reminderId: id, at: $0) }),
        ]
    }

    public func deleteReminder(_ id: String) async throws -> WireMap {
        var state = try state()
        let before = state.reminders.count
        state.reminders.removeAll { $0.id == id }
        state.occurrences.removeAll { $0.reminderId == id }
        try commit(state)
        await reconcile()
        return ["status": "ok", "affectedCount": before - state.reminders.count]
    }

    // MARK: Due moments

    /// The next moment [reminder] rings, honoring Pause all and Skip next.
    func nextOccurrence(of reminder: ReminderRecord, in state: KernelState) -> Date? {
        guard reminder.enabledIntent else { return nil }
        var after = now
        if let pause = state.preferences.pausedUntil, pause > now {
            if pause >= indefinitePause { return nil }
            // "No reminder rings before this instant": one exactly at it may.
            after = pause.addingTimeInterval(-0.001)
        }
        guard var next = ScheduleEngine.nextOccurrence(reminder.schedule, in: zone, after: after) else { return nil }
        if let skipped = reminder.skippedAt, abs(skipped.timeIntervalSince(next)) < 1 {
            guard let following = ScheduleEngine.nextOccurrence(reminder.schedule, in: zone, after: skipped) else { return nil }
            next = following
        }
        return next
    }

    /// Makes AlarmKit hold exactly the alarms the state implies. Idempotent;
    /// called after every mutation, at startup and when the app returns.
    public func reconcile() async {
        guard var state = try? state() else { return }
        guard alarms.authorization == .authorized else {
            // Nothing can be registered; forget what was, so the first
            // reconcile after Allow schedules everything.
            if !state.scheduledAlarms.isEmpty {
                state.scheduledAlarms = [:]
                try? commit(state)
            }
            return
        }
        // A skip that has passed is spent.
        for index in state.reminders.indices {
            if let skipped = state.reminders[index].skippedAt, skipped <= now { state.reminders[index].skippedAt = nil }
        }
        var desired: [String: PlannedAlarm] = [:]
        for reminder in state.reminders {
            if let plan = plannedAlarm(for: reminder, in: state) { desired[reminder.id] = plan }
        }
        for (id, plan) in desired where state.scheduledAlarms[id] != plan.signature {
            do {
                try await alarms.apply(plan)
                state.scheduledAlarms[id] = plan.signature
            } catch {
                // Not registered: leave it out so the next reconcile retries.
                state.scheduledAlarms.removeValue(forKey: id)
            }
        }
        for id in state.scheduledAlarms.keys where desired[id] == nil {
            await alarms.cancel(id: id)
            state.scheduledAlarms.removeValue(forKey: id)
        }
        schedulerGeneration += 1
        try? commit(state)
    }

    func plannedAlarm(for reminder: ReminderRecord, in state: KernelState) -> PlannedAlarm? {
        guard let next = nextOccurrence(of: reminder, in: state) else { return nil }
        let paused = state.preferences.pausedUntil.map { $0 > now } ?? false
        let schedule: PlannedAlarm.Schedule
        switch reminder.schedule {
        case let .daily(time) where !paused && reminder.skippedAt == nil:
            schedule = .weekly(time, isoWeekdays: Array(1...7))
        case let .weekdays(time, days) where !paused && reminder.skippedAt == nil:
            schedule = .weekly(time, isoWeekdays: days)
        default:
            schedule = .fixed(next)
        }
        let hasMedia = reminder.mediaId.map { id in state.media.contains { $0.id == id } } ?? false
        return PlannedAlarm(
            id: reminder.id,
            title: reminder.label,
            schedule: schedule,
            secondary: hasMedia ? .open : .snooze(minutes: reminder.snooze.defaultMinutes)
        )
    }

    /// The alarm's Open button (an App Intent in the Runner) lands here: stop
    /// the alert, hand the reminder to Dart, re-arm what comes next.
    public func recordOpen(alarmId: String) async {
        await alarms.stop(id: alarmId)
        guard var state = try? state(), let reminder = state.reminders.first(where: { $0.id == alarmId }) else { return }
        state.pendingOpen = PendingOpen(reminderId: reminder.id, mediaId: reminder.mediaId)
        record(.accepted, for: reminder, in: &state)
        try? commit(state)
        await reconcile()
    }

    func record(_ outcome: OccurrenceRecord.State, for reminder: ReminderRecord, in state: inout KernelState) {
        guard reminder.historyEnabled else { return }
        state.occurrences.append(OccurrenceRecord(id: occurrenceId(reminder.id, now), reminderId: reminder.id,
                                                  scheduledAt: now, state: outcome))
        // MR-09: occurrence history is kept for 90 days.
        let cutoff = now.addingTimeInterval(-90 * 86_400)
        state.occurrences.removeAll { $0.scheduledAt < cutoff }
    }

    public func takePendingOpen() throws -> WireMap {
        var state = try state()
        let pending = state.pendingOpen
        state.pendingOpen = nil
        if pending != nil { try commit(state) }
        return ["reminderId": wireNull(pending?.reminderId), "mediaId": wireNull(pending?.mediaId)]
    }

    /// In-app Play/Snooze/Dismiss. On iPhone the session is the reminder's
    /// alarm: the system owns the ringing, so these act on that alarm.
    public func resolveDue(action: String, sessionId: String, snoozeMinutes: Int?) async throws -> WireMap {
        var state = try state()
        guard let reminder = state.reminders.first(where: { $0.id == sessionId }) else {
            throw HostError.unknownId("sessionId")
        }
        var result: WireMap = ["sessionId": sessionId, "effectiveAt": WireInstant.format(now)]
        switch action {
        case "play":
            await alarms.stop(id: sessionId)
            state.pendingOpen = PendingOpen(reminderId: reminder.id, mediaId: reminder.mediaId)
            record(.accepted, for: reminder, in: &state)
            result["outcome"] = "playing"
        case "snooze":
            await alarms.snooze(id: sessionId)
            record(.snoozed, for: reminder, in: &state)
            let minutes = snoozeMinutes ?? reminder.snooze.defaultMinutes
            result["outcome"] = "snoozed"
            result["snoozedUntil"] = WireInstant.format(now.addingTimeInterval(TimeInterval(minutes * 60)))
        default:
            await alarms.stop(id: sessionId)
            record(.dismissed, for: reminder, in: &state)
            result["outcome"] = "dismissed"
        }
        try commit(state)
        await reconcile()
        if let next = nextOccurrence(of: reminder, in: try self.state()) {
            result["nextOccurrence"] = occurrenceWire(reminderId: reminder.id, at: next)
        }
        return result
    }

    public func statistics(rangeDays: Int) throws -> WireMap {
        let state = try state()
        let days = min(max(rangeDays, 1), 90)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let today = ScheduleEngine.localDate(of: now, calendar: calendar)
        let first = ScheduleEngine.adding(days: -(days - 1), to: today)
        let inRange = state.occurrences.filter { ScheduleEngine.localDate(of: $0.scheduledAt, calendar: calendar) >= first }
        func count(_ state: OccurrenceRecord.State, _ items: [OccurrenceRecord]) -> Int { items.filter { $0.state == state }.count }
        let breakdown: [Any] = (0..<days).map { offset in
            let date = ScheduleEngine.adding(days: offset, to: first)
            let items = inRange.filter { ScheduleEngine.localDate(of: $0.scheduledAt, calendar: calendar) == date }
            return ["date": date.wire, "completed": count(.accepted, items), "dismissed": count(.dismissed, items),
                    "missed": count(.missed, items)] as WireMap
        }
        let mostActive = Dictionary(grouping: inRange, by: \.reminderId).max { $0.value.count < $1.value.count }?.key
        let label = mostActive.flatMap { id in state.reminders.first { $0.id == id }?.label }
        return [
            "rangeDays": days,
            "totalOccurrences": inRange.count,
            "completed": count(.accepted, inRange),
            "dismissed": count(.dismissed, inRange),
            "missed": count(.missed, inRange),
            "snoozed": count(.snoozed, inRange),
            "mostActiveReminderLabel": wireNull(label),
            "dailyBreakdown": breakdown,
        ]
    }

    // MARK: Events

    public func cancelOperation(_ id: String) -> WireMap {
        operations.cancel(id)
        return ["status": "ok", "affectedCount": 0]
    }
}

extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}

/// A stable id for one reminder's moment, so the same moment keeps its id
/// across reads (Dart compares occurrences by id).
func occurrenceId(_ reminderId: String, _ at: Date) -> String {
    let hex = SHA256Hasher.hex(Data("\(reminderId)|\(Int(at.timeIntervalSince1970))".utf8))
    let chars = Array(hex.prefix(32))
    func part(_ range: Range<Int>) -> String { String(chars[range]) }
    return "\(part(0..<8))-\(part(8..<12))-4\(part(13..<16))-a\(part(17..<20))-\(part(20..<32))"
}
