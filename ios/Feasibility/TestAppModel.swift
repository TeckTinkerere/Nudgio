import AlarmKit
import Combine
import Foundation

@MainActor final class TestAppModel: ObservableObject {
    static let shared = TestAppModel()
    let backend = AlarmKitBackend()
    lazy var coordinator = TestAlarmCoordinator(backend: backend)
    @Published var authorization: AlarmAuthorization = .unknown
    @Published var alarms: [RegisteredTestAlarm] = []
    @Published var error: String?
    @Published var notice: String?
    @Published var checkedAt: Date?
    @Published var busy = false
    @Published var openedTest: OpenedTest?

    func refresh() {
        authorization = backend.authorization
        do {
            let actual = try backend.registrations()
            alarms = actual
            checkedAt = Date()
            error = nil
        } catch {
            // Preserve last observed rows, explicitly stale; never pretend empty means success.
            self.error = "Could not check iOS alarms. The list below may be out of date. \(error.localizedDescription)"
            checkedAt = nil
        }
    }
    func authorize() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            _ = try await backend.requestAuthorization()
            refresh()
        } catch { self.error = error.localizedDescription }
    }
    func schedule(_ request: TestAlarmRequest, probe: Bool) async {
        guard !busy else { return }
        busy = true
        error = nil
        notice = nil
        defer { busy = false }
        do {
            _ = try await coordinator.schedule(request, probe: probe)
            refresh()
            if checkedAt != nil { notice = "Test registered with iOS. This confirms registration, not delivery." }
        } catch {
            let failure = error.localizedDescription
            refresh()
            self.error = "The test was not confirmed. \(failure) Check the registrations below before retrying."
        }
    }
    func cancel(_ id: UUID) {
        guard !busy else { return }
        do {
            try coordinator.cancel(id)
            refresh()
            if checkedAt != nil { notice = "Test cancellation confirmed." }
        } catch { self.error = error.localizedDescription; checkedAt = nil }
    }
    func stop(_ id: UUID) {
        do { try coordinator.stop(id); refresh() }
        catch { self.error = error.localizedDescription; checkedAt = nil }
    }
    func observeChanges() async {
        refresh()
        // Event-driven while the view is alive; no polling, background task or keep-alive.
        for await _ in AlarmManager.shared.alarmUpdates {
            if Task.isCancelled { return }
            refresh()
        }
    }
}

struct OpenedTest: Identifiable { let id: UUID }
