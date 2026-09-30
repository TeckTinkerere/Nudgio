import SwiftUI

@main struct NudgioFeasibilityApp: App {
    @StateObject private var model = TestAppModel.shared
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            AlarmCheckScreen(model: model)
                .task { await model.observeChanges() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.refresh() }
                }
                .sheet(item: $model.openedTest) { test in
                    NativeTestReminderScreen(testID: test.id)
                }
        }
    }
}

private struct NativeTestReminderScreen: View {
    let testID: UUID
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label("Your test reminder", systemImage: "sparkle")
                        .font(.title2).accessibilityAddTraits(.isHeader)
                    Text("This screen opens entirely in native iPhone code. No JavaScript or React Native bundle is required.")
                    Text("This test has no attachment. Nothing starts playing automatically.")
                }
                Section("Test identifier") { Text(testID.uuidString).font(.caption).textSelection(.enabled) }
            }
            .navigationTitle("Reminder")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .scrollContentBackground(.hidden)
            .background(Brand.background(scheme))
        }.tint(Brand.accent(scheme))
    }
}
