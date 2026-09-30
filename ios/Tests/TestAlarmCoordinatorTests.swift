import XCTest
@testable import NudgioFeasibility

@MainActor final class TestAlarmCoordinatorTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 2_000_000_000)
    private var request: TestAlarmRequest {
        TestAlarmRequest(date: now.addingTimeInterval(120), recurrence: .once,
                         weekdays: [], action: .snooze, snoozeMinutes: 10)
    }

    func testRejectsPastOneTimeAlarm() {
        var value = request
        value.date = now.addingTimeInterval(-1)
        XCTAssertThrowsError(try value.validate(now: now))
    }
    func testRepeatingTimeDoesNotRequireFutureDateComponent() {
        var value = request
        value.recurrence = .daily
        value.date = now.addingTimeInterval(-86_400)
        XCTAssertNoThrow(try value.validate(now: now))
    }
    func testWeekdaysRejectEmptyAndOutOfRange() {
        var value = request
        value.recurrence = .weekdays
        XCTAssertThrowsError(try value.validate(now: now))
        value.weekdays = [0, 8]
        XCTAssertThrowsError(try value.validate(now: now))
        value.weekdays = [1, 7]
        XCTAssertNoThrow(try value.validate(now: now))
    }
    func testUnsupportedSnoozeIsRejected() {
        var value = request
        value.snoozeMinutes = 2
        XCTAssertThrowsError(try value.validate(now: now))
    }
    func testDeniedPermissionNeverSchedules() async {
        let backend = FakeAlarmBackend()
        backend.authorization = .denied
        do { _ = try await TestAlarmCoordinator(backend: backend).schedule(request, now: now); XCTFail("Expected denied") }
        catch { XCTAssertTrue(backend.scheduled.isEmpty) }
    }
    func testChoosesUnusedSlotWithoutReplacingExistingAlarm() async throws {
        let backend = FakeAlarmBackend()
        let first = TestAlarmIdentity.baseIDs[0]
        backend.rows = [backend.row(first)]
        let id = try await TestAlarmCoordinator(backend: backend).schedule(request, now: now)
        XCTAssertNotEqual(id, first)
        XCTAssertTrue(backend.rows.contains { $0.id == first })
        XCTAssertTrue(backend.cancelled.isEmpty)
    }
    func testLocalCapacityDoesNotEvict() async {
        let backend = FakeAlarmBackend()
        backend.rows = TestAlarmIdentity.baseIDs.map { backend.row($0) }
        do { _ = try await TestAlarmCoordinator(backend: backend).schedule(request, now: now); XCTFail("Expected capacity") }
        catch { XCTAssertTrue(backend.scheduled.isEmpty); XCTAssertTrue(backend.cancelled.isEmpty) }
    }
    func testSystemCapacityErrorPreservesOtherRegistrations() async {
        let backend = FakeAlarmBackend()
        backend.rows = [backend.row(TestAlarmIdentity.baseIDs[0])]
        backend.failSchedule = true
        do { _ = try await TestAlarmCoordinator(backend: backend).schedule(request, now: now); XCTFail("Expected OS error") }
        catch { XCTAssertEqual(backend.rows.count, 1); XCTAssertTrue(backend.cancelled.isEmpty) }
    }
    func testMissingRegistrationIsNotReportedSuccessful() async {
        let backend = FakeAlarmBackend()
        backend.omitRegistration = true
        do { _ = try await TestAlarmCoordinator(backend: backend).schedule(request, now: now); XCTFail("Expected unconfirmed") }
        catch { XCTAssertEqual(backend.scheduled.count, 1) }
    }
    func testEnumerationFailureDoesNotSchedule() async {
        let backend = FakeAlarmBackend()
        backend.failEnumeration = true
        do { _ = try await TestAlarmCoordinator(backend: backend).schedule(request, now: now); XCTFail("Expected read error") }
        catch { XCTAssertTrue(backend.scheduled.isEmpty) }
    }
    func testExtraProbeDoesNotReplaceTwentyBaseAlarms() async throws {
        let backend = FakeAlarmBackend()
        backend.rows = TestAlarmIdentity.baseIDs.map { backend.row($0) }
        let coordinator = TestAlarmCoordinator(backend: backend)
        let id = try await coordinator.schedule(request, probe: true, now: now)
        XCTAssertEqual(id, TestAlarmIdentity.probeID)
        XCTAssertEqual(backend.rows.count, 21)
        do { _ = try await coordinator.schedule(request, probe: true, now: now); XCTFail("Expected existing probe") }
        catch { XCTAssertEqual(backend.rows.count, 21) }
        XCTAssertTrue(backend.cancelled.isEmpty)
    }
    func testCancelIsIdempotentAndConfirmsRemoval() throws {
        let backend = FakeAlarmBackend()
        let id = TestAlarmIdentity.baseIDs[0]
        backend.rows = [backend.row(id)]
        let coordinator = TestAlarmCoordinator(backend: backend)
        try coordinator.cancel(id)
        try coordinator.cancel(id)
        XCTAssertEqual(backend.cancelled, [id])
        XCTAssertTrue(backend.rows.isEmpty)
    }
    func testFailedCancellationRemainsVisible() {
        let backend = FakeAlarmBackend()
        let id = TestAlarmIdentity.baseIDs[0]
        backend.rows = [backend.row(id)]
        backend.ignoreCancel = true
        XCTAssertThrowsError(try TestAlarmCoordinator(backend: backend).cancel(id))
        XCTAssertEqual(backend.rows.count, 1)
    }
    func testCannotCancelForeignAlarm() {
        let backend = FakeAlarmBackend()
        XCTAssertThrowsError(try TestAlarmCoordinator(backend: backend).cancel(UUID()))
        XCTAssertTrue(backend.cancelled.isEmpty)
    }
    func testStopPreservesRecurrenceAndRepeatedOpenIsHarmless() throws {
        let backend = FakeAlarmBackend()
        let id = TestAlarmIdentity.baseIDs[0]
        backend.rows = [backend.row(id, state: "alerting")]
        let coordinator = TestAlarmCoordinator(backend: backend)
        try coordinator.stop(id)
        try coordinator.stop(id)
        XCTAssertEqual(backend.stopped, [id])
        XCTAssertEqual(backend.rows.first?.state, "scheduled")
        XCTAssertTrue(backend.cancelled.isEmpty)
    }
    func testSyntheticIDsAreUniqueAndRejectUntrustedInput() {
        XCTAssertEqual(TestAlarmIdentity.allIDs.count, 21)
        XCTAssertThrowsError(try TestAlarmIdentity.validated("../../private"))
        XCTAssertThrowsError(try TestAlarmIdentity.validated(UUID().uuidString))
    }
}

@MainActor private final class FakeAlarmBackend: AlarmBackend {
    var authorization: AlarmAuthorization = .authorized
    var rows: [RegisteredTestAlarm] = []
    var scheduled: [UUID] = []
    var cancelled: [UUID] = []
    var stopped: [UUID] = []
    var failSchedule = false
    var failEnumeration = false
    var omitRegistration = false
    var ignoreCancel = false
    enum Failure: Error { case injected }
    func row(_ id: UUID, state: String = "scheduled") -> RegisteredTestAlarm {
        RegisteredTestAlarm(id: id, state: state, scheduleDescription: "Synthetic schedule")
    }
    func requestAuthorization() async throws -> AlarmAuthorization { authorization }
    func registrations() throws -> [RegisteredTestAlarm] {
        if failEnumeration { throw Failure.injected }
        return rows
    }
    func schedule(id: UUID, request: TestAlarmRequest) async throws {
        if failSchedule { throw Failure.injected }
        scheduled.append(id)
        if !omitRegistration { rows.append(row(id)) }
    }
    func cancel(id: UUID) throws {
        cancelled.append(id)
        if !ignoreCancel { rows.removeAll { $0.id == id } }
    }
    func stop(id: UUID) throws {
        stopped.append(id)
        rows = rows.map { $0.id == id ? row(id) : $0 }
    }
}
