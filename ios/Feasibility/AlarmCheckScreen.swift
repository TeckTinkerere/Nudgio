import SwiftUI

struct AlarmCheckScreen: View {
    @ObservedObject var model: TestAppModel
    @Environment(\.colorScheme) private var scheme
    @Environment(\.openURL) private var openURL
    @State private var date = Date().addingTimeInterval(120)
    @State private var recurrence = TestRecurrence.once
    @State private var action = TestAction.snooze
    @State private var weekdays: Set<Int> = [1, 2, 3, 4, 5]
    @State private var snoozeMinutes = 10
    @State private var cancelTarget: RegisteredTestAlarm?
    @State private var showProbeConfirmation = false

    private var request: TestAlarmRequest {
        TestAlarmRequest(date: date, recurrence: recurrence, weekdays: weekdays,
                         action: action, snoozeMinutes: snoozeMinutes)
    }
    private var validationMessage: String? {
        do { try request.validate(now: Date()); return nil }
        catch { return error.localizedDescription }
    }
    private var canSchedule: Bool {
        model.authorization == .authorized && !model.busy && validationMessage == nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("A reminder, with what you need.", systemImage: "sparkle")
                        .font(.title2).accessibilityAddTraits(.isHeader)
                    Text("iPhone development build · Native alarm check")
                        .font(.subheadline).foregroundStyle(.secondary)
                    Text("These are synthetic test alarms. They can sound while this app is closed. Cancel recurring tests when you finish.")
                }
                Section("Alarm access") {
                    LabeledContent("Permission", value: model.authorization.rawValue)
                    if model.authorization == .notDetermined {
                        Text("Allow alarms when you are ready to run a test. No permission is requested just by opening the app.")
                        Button("Allow test alarms") { Task { await model.authorize() } }.disabled(model.busy)
                    } else if model.authorization == .denied {
                        Text("Allow alarm access in Settings, then return here. No notification substitute will be scheduled.")
                        Button("Open Settings") {
                            if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                        }
                    }
                    Button("Refresh alarm status", systemImage: "arrow.clockwise") { model.refresh() }
                        .disabled(model.busy)
                }
                Section("Set a test") {
                    Picker("Repeat", selection: $recurrence) {
                        ForEach(TestRecurrence.allCases) { Text($0.title).tag($0) }
                    }
                    DatePicker("Time", selection: $date,
                               displayedComponents: recurrence == .once ? [.date, .hourAndMinute] : [.hourAndMinute])
                    if recurrence == .weekdays {
                        // Locale weekday labels are Monday-first here; no hardcoded English abbreviations.
                        ForEach(1...7, id: \.self) { day in
                            Toggle(Calendar.current.weekdaySymbols[day % 7], isOn: Binding(
                                get: { weekdays.contains(day) },
                                set: { if $0 { weekdays.insert(day) } else { weekdays.remove(day) } }))
                        }
                    }
                    Picker("Second alarm action", selection: $action) {
                        ForEach(TestAction.allCases) { Text($0.title).tag($0) }
                    }
                    if action == .snooze {
                        Picker("Snooze duration", selection: $snoozeMinutes) {
                            ForEach([5, 10, 15, 30], id: \.self) { Text("\($0) minutes").tag($0) }
                        }
                    }
                    Text(recurrence == .once ? "One-time tests use the chosen absolute date." : "Repeating tests follow local wall-clock time. DST and travel behaviour still require device validation.")
                        .font(.footnote).foregroundStyle(.secondary)
                    if let message = validationMessage { Text(message).foregroundStyle(.secondary) }
                    Button(model.busy ? "Working…" : "Schedule test alarm", systemImage: "alarm") {
                        Task { await model.schedule(request, probe: false) }
                    }.disabled(!canSchedule)
                    if model.authorization != .authorized {
                        Text("Allow alarm access before scheduling.").font(.footnote)
                    }
                }
                if let error = model.error {
                    Section("Needs attention") { Label(error, systemImage: "exclamationmark.triangle") }
                }
                if let notice = model.notice { Section { Text(notice) } }
                Section("Registered tests") {
                    if model.checkedAt == nil { Text("Current registration status is unverified. Refresh to check.") }
                    else if model.alarms.isEmpty { Text("No test alarms are registered with iOS.") }
                    ForEach(model.alarms) { alarm in
                        VStack(alignment: .leading, spacing: 12) {
                            Text(alarm.id == TestAlarmIdentity.probeID ? "Extra capacity test" : "Nudgio test")
                                .font(.headline)
                            LabeledContent("Observed state", value: model.authorization == .authorized
                                           ? alarm.state : "Alarm access unavailable")
                            Text(alarm.scheduleDescription).font(.caption).textSelection(.enabled)
                            if alarm.state == "alerting" {
                                Button("Stop current alert") { model.stop(alarm.id) }.disabled(model.busy)
                            }
                            Button("Cancel this test", role: .destructive) { cancelTarget = alarm }.disabled(model.busy)
                        }.padding(.vertical, 4)
                    }
                    if let checked = model.checkedAt {
                        Text("Last checked \(checked.formatted(date: .omitted, time: .standard))").font(.footnote)
                    }
                }
                Section("Capacity check") {
                    Text("The normal test pool holds 20 alarms. The extra slot checks whether iOS accepts one more; existing alarms are never removed automatically.")
                    Button("Schedule extra test…") { showProbeConfirmation = true }
                        .disabled(!canSchedule || recurrence != .once)
                    Text("The extra test must be one-time. Device results do not establish a universal iOS limit.").font(.footnote)
                }
                Section("Privacy") {
                    Text("No account, sync, analytics or app networking. Alarm titles and content are synthetic. This is not the finished reminder app.")
                }
            }
            .navigationTitle("Nudgio")
            .scrollContentBackground(.hidden)
            .background(Brand.background(scheme))
            .tint(Brand.accent(scheme))
            .confirmationDialog("Cancel this test and its future repeats?", isPresented: Binding(
                get: { cancelTarget != nil }, set: { if !$0 { cancelTarget = nil } })) {
                    if let target = cancelTarget {
                        Button("Cancel test alarm", role: .destructive) { model.cancel(target.id); cancelTarget = nil }
                    }
                }
            .confirmationDialog("Schedule one extra audible test?", isPresented: $showProbeConfirmation) {
                Button("Schedule extra test") { Task { await model.schedule(request, probe: true) } }
            }
        }
    }
}
