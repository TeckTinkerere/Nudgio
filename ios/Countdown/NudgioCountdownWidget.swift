import ActivityKit
import AlarmKit
import SwiftUI
import WidgetKit

@main struct NudgioCountdownBundle: WidgetBundle {
    var body: some Widget { NudgioCountdownWidget() }
}

struct NudgioCountdownWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<NudgioAlarmMetadata>.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                Label("Nudgio test", systemImage: "alarm").font(.headline)
                CountdownLabel(state: context.state)
                Text("Open Nudgio Test to cancel this test.").font(.caption)
            }
            .padding()
            .activityBackgroundTint(Brand.midnight)
            .activitySystemActionForegroundColor(Brand.moon)
            .foregroundStyle(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Label("Nudgio", systemImage: "alarm") }
                DynamicIslandExpandedRegion(.bottom) { CountdownLabel(state: context.state) }
            } compactLeading: {
                Image(systemName: "alarm")
            } compactTrailing: {
                CountdownLabel(state: context.state)
            } minimal: {
                Image(systemName: "alarm")
            }
            .keylineTint(Brand.apricot)
        }
    }
}

private struct CountdownLabel: View {
    let state: AlarmPresentationState
    var body: some View {
        switch state.mode {
        case .countdown(let countdown):
            Text(timerInterval: countdown.startDate...countdown.fireDate, countsDown: true)
                .monospacedDigit().accessibilityLabel("Time until test alarm")
        case .paused:
            Text("Paused")
        case .alert:
            Text("Test alarm")
        @unknown default:
            Text("Open Nudgio Test")
        }
    }
}
