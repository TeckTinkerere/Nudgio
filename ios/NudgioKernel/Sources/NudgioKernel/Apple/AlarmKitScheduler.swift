#if os(iOS) && canImport(AlarmKit)
import AlarmKit
import AppIntents
import Foundation
import SwiftUI

/// Presentation metadata only: the reminder an alarm belongs to. No title,
/// path or note (the lock screen shows the alarm's own title).
public struct NudgioAlarmMetadata: AlarmMetadata {
    public let reminderId: String

    public init(reminderId: String) {
        self.reminderId = reminderId
    }
}

/// `AlarmScheduling` over AlarmKit, grown from the feasibility target's
/// `AlarmKitBackend` (ios/Feasibility). Stop is always the system's; the
/// secondary button is the system countdown Snooze, or Open, whose App Intent
/// lives in the Runner (App Intents must be in the app target) and is passed
/// in as [makeOpenIntent].
public final class AlarmKitScheduler: AlarmScheduling {
    private let manager = AlarmManager.shared
    private let makeOpenIntent: (String) -> (any LiveActivityIntent)?

    public init(makeOpenIntent: @escaping (String) -> (any LiveActivityIntent)?) {
        self.makeOpenIntent = makeOpenIntent
    }

    public var authorization: AlarmAuthorization {
        switch manager.authorizationState {
        case .authorized: return .authorized
        case .denied: return .denied
        case .notDetermined: return .notDetermined
        @unknown default: return .notDetermined
        }
    }

    public func requestAuthorization() async -> AlarmAuthorization {
        _ = try? await manager.requestAuthorization()
        return authorization
    }

    public func apply(_ alarm: PlannedAlarm) async throws {
        guard let id = UUID(uuidString: alarm.id) else { return }
        // AlarmKit has no update: replace by id.
        try? manager.cancel(id: id)

        let schedule: Alarm.Schedule
        switch alarm.schedule {
        case let .fixed(date):
            schedule = .fixed(date)
        case let .weekly(time, isoWeekdays):
            let days: [Locale.Weekday] = [.monday, .tuesday, .wednesday, .thursday, .friday, .saturday, .sunday]
            schedule = .relative(.init(
                time: .init(hour: time.hour, minute: time.minute),
                repeats: .weekly(isoWeekdays.sorted().map { days[$0 - 1] })
            ))
        }

        let snoozeMinutes: Int?
        let secondaryButton: AlarmButton
        let secondaryIntent: (any LiveActivityIntent)?
        switch alarm.secondary {
        case let .snooze(minutes):
            snoozeMinutes = minutes
            secondaryButton = AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz")
            secondaryIntent = nil
        case .open:
            snoozeMinutes = nil
            secondaryButton = AlarmButton(text: "Open", textColor: .white, systemImageName: "play.circle")
            secondaryIntent = makeOpenIntent(alarm.id)
        }

        let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource("\(alarm.title)"),
            stopButton: AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle"),
            secondaryButton: secondaryButton,
            secondaryButtonBehavior: snoozeMinutes == nil ? .custom : .countdown
        )
        let presentation = AlarmPresentation(
            alert: alert,
            countdown: snoozeMinutes == nil ? nil : .init(title: LocalizedStringResource("Snoozed: \(alarm.title)"))
        )
        let attributes = AlarmAttributes(
            presentation: presentation,
            metadata: NudgioAlarmMetadata(reminderId: alarm.id),
            tintColor: Color(red: 0.96, green: 0.62, blue: 0.42)
        )
        let configuration = AlarmManager.AlarmConfiguration(
            countdownDuration: snoozeMinutes.map { Alarm.CountdownDuration(preAlert: nil, postAlert: TimeInterval($0 * 60)) },
            schedule: schedule,
            attributes: attributes,
            stopIntent: nil,
            secondaryIntent: secondaryIntent
        )
        _ = try await manager.schedule(id: id, configuration: configuration)
    }

    public func cancel(id: String) async {
        guard let uuid = UUID(uuidString: id) else { return }
        try? manager.cancel(id: uuid)
    }

    public func stop(id: String) async {
        guard let uuid = UUID(uuidString: id) else { return }
        try? manager.stop(id: uuid)
    }

    public func snooze(id: String) async {
        guard let uuid = UUID(uuidString: id) else { return }
        try? manager.countdown(id: uuid)
    }
}
#endif
