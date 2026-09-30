import Foundation

enum AlarmAuthorization: String { case notDetermined, authorized, denied, unknown }
enum TestRecurrence: String, CaseIterable, Identifiable {
    case once, daily, weekdays
    var id: String { rawValue }
    var title: String {
        switch self { case .once: return "Once"; case .daily: return "Every day"; case .weekdays: return "Selected weekdays" }
    }
}
enum TestAction: String, CaseIterable, Identifiable {
    case snooze, open
    var id: String { rawValue }
    var title: String { self == .snooze ? "Snooze" : "Open reminder" }
}
struct TestAlarmRequest {
    var date: Date
    var recurrence: TestRecurrence
    // ISO weekday numbers: Monday = 1, Sunday = 7.
    var weekdays: Set<Int>
    var action: TestAction
    var snoozeMinutes: Int

    func validate(now: Date) throws {
        guard date.timeIntervalSince1970.isFinite else { throw TestAlarmError.invalidDate }
        if recurrence == .once && date.timeIntervalSince(now) < 10 { throw TestAlarmError.pastDate }
        if recurrence == .weekdays && (weekdays.isEmpty || !weekdays.isSubset(of: Set(1...7))) {
            throw TestAlarmError.invalidWeekdays
        }
        guard [5, 10, 15, 30].contains(snoozeMinutes) else { throw TestAlarmError.invalidSnooze }
    }
}
struct RegisteredTestAlarm: Identifiable, Equatable {
    let id: UUID
    let state: String
    let scheduleDescription: String
}
enum TestAlarmError: LocalizedError {
    case invalidDate, pastDate, invalidWeekdays, invalidSnooze, invalidProbe, permission, busy, capacity, probeExists, unconfirmed
    var errorDescription: String? {
        switch self {
        case .invalidDate: return "Choose a valid date."
        case .pastDate: return "Choose a time at least ten seconds from now."
        case .invalidWeekdays: return "Choose at least one weekday."
        case .invalidSnooze: return "Choose 5, 10, 15 or 30 minutes."
        case .invalidProbe: return "The extra capacity test must be one-time."
        case .permission: return "Alarm access is not allowed. Enable it in Settings, then refresh."
        case .busy: return "Another alarm operation is still running."
        case .capacity: return "All 20 test slots are in use. Cancel a test explicitly before adding another."
        case .probeExists: return "The extra test slot is in use. Cancel that test first."
        case .unconfirmed: return "iOS did not confirm the requested change. Refresh to inspect the actual registrations."
        }
    }
}

@MainActor protocol AlarmBackend {
    var authorization: AlarmAuthorization { get }
    func requestAuthorization() async throws -> AlarmAuthorization
    func registrations() throws -> [RegisteredTestAlarm]
    func schedule(id: UUID, request: TestAlarmRequest) async throws
    func cancel(id: UUID) throws
    func stop(id: UUID) throws
}

/// A bounded feasibility command service, not the production persistence layer.
@MainActor final class TestAlarmCoordinator {
    private let backend: any AlarmBackend
    private(set) var isApplying = false
    init(backend: any AlarmBackend) { self.backend = backend }

    func schedule(_ request: TestAlarmRequest, probe: Bool = false, now: Date = Date()) async throws -> UUID {
        guard !isApplying else { throw TestAlarmError.busy }
        isApplying = true
        defer { isApplying = false }
        try request.validate(now: now)
        if probe && request.recurrence != .once { throw TestAlarmError.invalidProbe }
        guard backend.authorization == .authorized else { throw TestAlarmError.permission }
        let occupied = Set(try backend.registrations().map(\.id))
        let id: UUID
        if probe {
            guard !occupied.contains(TestAlarmIdentity.probeID) else { throw TestAlarmError.probeExists }
            id = TestAlarmIdentity.probeID
        } else {
            guard let available = TestAlarmIdentity.baseIDs.first(where: { !occupied.contains($0) }) else {
                throw TestAlarmError.capacity
            }
            id = available
        }
        try await backend.schedule(id: id, request: request)
        guard backend.authorization == .authorized else { throw TestAlarmError.permission }
        guard try backend.registrations().contains(where: { $0.id == id }) else { throw TestAlarmError.unconfirmed }
        return id
    }

    func cancel(_ id: UUID) throws {
        guard !isApplying else { throw TestAlarmError.busy }
        _ = try TestAlarmIdentity.validated(id.uuidString)
        if try backend.registrations().contains(where: { $0.id == id }) { try backend.cancel(id: id) }
        guard try !backend.registrations().contains(where: { $0.id == id }) else { throw TestAlarmError.unconfirmed }
    }

    func stop(_ id: UUID) throws {
        _ = try TestAlarmIdentity.validated(id.uuidString)
        // Stop the current alert; never cancel a recurring registration here.
        if try backend.registrations().contains(where: { $0.id == id && $0.state == "alerting" }) {
            try backend.stop(id: id)
        }
    }
}
