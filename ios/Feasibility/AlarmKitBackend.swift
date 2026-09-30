import AlarmKit
import Foundation
import SwiftUI

@MainActor final class AlarmKitBackend: AlarmBackend {
    private let manager = AlarmManager.shared
    var authorization: AlarmAuthorization {
        switch manager.authorizationState {
        case .notDetermined: return .notDetermined
        case .authorized: return .authorized
        case .denied: return .denied
        @unknown default: return .unknown
        }
    }
    func requestAuthorization() async throws -> AlarmAuthorization {
        _ = try await manager.requestAuthorization()
        return authorization
    }
    func registrations() throws -> [RegisteredTestAlarm] {
        try manager.alarms.filter { TestAlarmIdentity.allIDs.contains($0.id) }.map {
            RegisteredTestAlarm(id: $0.id, state: String(describing: $0.state),
                                scheduleDescription: String(describing: $0.schedule))
        }.sorted { $0.id.uuidString < $1.id.uuidString }
    }
    func schedule(id: UUID, request: TestAlarmRequest) async throws {
        _ = try TestAlarmIdentity.validated(id.uuidString)
        let schedule: Alarm.Schedule
        if request.recurrence == .once {
            schedule = .fixed(request.date)
        } else {
            let calendar = Calendar.current
            let time = Alarm.Schedule.Relative.Time(hour: calendar.component(.hour, from: request.date),
                                                   minute: calendar.component(.minute, from: request.date))
            let days: [Locale.Weekday] = [.monday, .tuesday, .wednesday, .thursday, .friday, .saturday, .sunday]
            let selected = request.recurrence == .daily ? days : request.weekdays.sorted().map { days[$0 - 1] }
            schedule = .relative(.init(time: time, repeats: .weekly(selected)))
        }
        let snooze = request.action == .snooze
        let alert = AlarmPresentation.Alert(
            title: "Nudgio test reminder",
            stopButton: AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle"),
            secondaryButton: AlarmButton(text: snooze ? "Snooze" : "Open reminder",
                                         textColor: Brand.midnight,
                                         systemImageName: snooze ? "zzz" : "arrow.up.right"),
            secondaryButtonBehavior: snooze ? .countdown : .custom)
        let presentation = AlarmPresentation(
            alert: alert,
            countdown: snooze ? .init(title: "Nudgio test snoozed") : nil)
        let attributes = AlarmAttributes(presentation: presentation,
                                         metadata: NudgioAlarmMetadata(testID: id.uuidString),
                                         tintColor: Brand.apricot)
        let openIntent: OpenTestReminderIntent? = snooze ? nil : OpenTestReminderIntent(alarmID: id.uuidString)
        let configuration = AlarmManager.AlarmConfiguration(
            countdownDuration: snooze ? .init(preAlert: nil, postAlert: TimeInterval(request.snoozeMinutes * 60)) : nil,
            schedule: schedule,
            attributes: attributes,
            stopIntent: nil,
            secondaryIntent: openIntent)
        // System Stop and countdown Snooze are intentionally not replaced by app callbacks.
        _ = try await manager.schedule(id: id, configuration: configuration)
    }
    func cancel(id: UUID) throws { try manager.cancel(id: id) }
    func stop(id: UUID) throws { try manager.stop(id: id) }
}
