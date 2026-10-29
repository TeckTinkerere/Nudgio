import Foundation
import XCTest
@testable import NudgioKernel

final class ReminderFlowTests: XCTestCase {
    func testSaveListAndDeleteAnAlarmWithNoAttachment() async throws {
        let h = Harness()
        let saved = try await h.map("saveReminder", ["request": reminderRequest()])
        let reminder = try XCTUnwrap(saved["reminder"] as? WireMap)
        XCTAssertTrue(reminder["mediaId"] is NSNull)
        XCTAssertEqual(reminder["repeatSummary"] as? String, "Every day at 9:00 PM")
        XCTAssertEqual(reminder["effectiveState"] as? String, "active")
        XCTAssertEqual((saved["capabilityResult"] as? WireMap)?["status"] as? String, "ok")
        // 09:00 now, 21:00 today in Singapore = 13:00Z.
        XCTAssertEqual((saved["nextOccurrence"] as? WireMap)?["scheduledAt"] as? String, "2026-10-28T13:00:00Z")

        let id = try XCTUnwrap(reminder["id"] as? String)
        let page = try await h.map("listReminders")
        XCTAssertEqual((page["items"] as? [Any])?.count, 1)
        XCTAssertEqual(page["total"] as? Int, 1)

        // A daily rule rides AlarmKit's own weekly repeat, with Snooze (no media).
        XCTAssertEqual(h.platform.applied, [PlannedAlarm(
            id: id, title: "Medicine", schedule: .weekly(LocalTime(hour: 21, minute: 0), isoWeekdays: Array(1...7)),
            secondary: .snooze(minutes: 10)
        )])

        let deleted = try await h.map("deleteReminder", ["id": id])
        XCTAssertEqual(deleted["affectedCount"] as? Int, 1)
        XCTAssertEqual(h.platform.cancelled, [id])
        XCTAssertTrue(h.platform.applied.isEmpty)
    }

    func testValidationUsesAndroidsFieldNames() async {
        let h = Harness()
        await expectHostError("label") { try await h.call("saveReminder", ["request": reminderRequest(label: "  ")]) }
        await expectHostError("profileId") {
            try await h.call("saveReminder", ["request": reminderRequest(extra: ["profileId": "nope"])])
        }
        await expectHostError("schedule") {
            try await h.call("saveReminder", ["request": reminderRequest(schedule: ["type": "weekdays", "localTime": "07:00:00", "isoWeekdays": [Int]()])])
        }
        await expectHostError("action.uri") {
            try await h.call("saveReminder", ["request": reminderRequest(extra: ["action": ["type": "open_link", "uri": "javascript:alert(1)"]])])
        }
        await expectHostError("id") { try await h.call("getReminder", ["id": "00000000-0000-4000-8000-00000000dead"]) }
    }

    func testAStaleEditIsARetryableConflict() async throws {
        let h = Harness()
        let saved = try await h.map("saveReminder", ["request": reminderRequest()])
        let id = try XCTUnwrap((saved["reminder"] as? WireMap)?["id"] as? String)
        _ = try await h.call("saveReminder", ["request": reminderRequest(label: "Edit 1", extra: ["id": id, "entityVersion": 1])])
        do {
            _ = try await h.call("saveReminder", ["request": reminderRequest(label: "Edit 2", extra: ["id": id, "entityVersion": 1])])
            XCTFail("expected a conflict")
        } catch let error as HostError {
            XCTAssertEqual(error.field, "entityVersion")
            XCTAssertTrue(error.retryable)
        }
    }

    func testDisablingCancelsAndTheEnabledCapHolds() async throws {
        let h = Harness()
        var ids: [String] = []
        for index in 0..<NudgioKernel.maxEnabledReminders {
            let saved = try await h.map("saveReminder", ["request": reminderRequest(label: "R\(index)")])
            ids.append(try XCTUnwrap((saved["reminder"] as? WireMap)?["id"] as? String))
        }
        await expectHostError("enabledLimit") { try await h.call("saveReminder", ["request": reminderRequest(label: "One too many")]) }

        let disabled = try await h.map("setReminderEnabled", ["id": ids[0], "enabled": false])
        XCTAssertTrue(disabled["nextOccurrence"] is NSNull)
        XCTAssertEqual((disabled["reminder"] as? WireMap)?["effectiveState"] as? String, "disabled")
        XCTAssertTrue(h.platform.cancelled.contains(ids[0]))
        _ = try await h.call("saveReminder", ["request": reminderRequest(label: "Fits now")])
    }

    func testSkipNextUsesAFixedAlarmForTheFollowingMoment() async throws {
        let h = Harness()
        let saved = try await h.map("saveReminder", ["request": reminderRequest()])
        let id = try XCTUnwrap((saved["reminder"] as? WireMap)?["id"] as? String)
        let skipped = try await h.map("skipNextOccurrence", ["id": id, "skip": true])
        XCTAssertEqual((skipped["reminder"] as? WireMap)?["skippedAt"] as? String, "2026-10-28T13:00:00Z")
        XCTAssertEqual((skipped["nextOccurrence"] as? WireMap)?["scheduledAt"] as? String, "2026-10-29T13:00:00Z")
        XCTAssertEqual(h.platform.applied.first?.schedule, .fixed(WireInstant.parse("2026-10-29T13:00:00Z")!))

        let undone = try await h.map("skipNextOccurrence", ["id": id, "skip": false])
        XCTAssertTrue((undone["reminder"] as? WireMap)?["skippedAt"] is NSNull)

        let once = try await h.map("saveReminder", ["request": reminderRequest(schedule: [
            "type": "once", "instant": "2026-11-01T13:00:00Z", "originZone": "Asia/Singapore",
        ])])
        let onceId = try XCTUnwrap((once["reminder"] as? WireMap)?["id"] as? String)
        await expectHostError("notRepeating") { try await h.call("skipNextOccurrence", ["id": onceId, "skip": true]) }
    }

    func testPauseAllHoldsEverythingUntilItEnds() async throws {
        let h = Harness()
        let saved = try await h.map("saveReminder", ["request": reminderRequest()])
        let id = try XCTUnwrap((saved["reminder"] as? WireMap)?["id"] as? String)

        let prefs = try await h.map("setPausedUntil", ["until": "2026-10-30T00:00:00Z"])
        XCTAssertEqual(prefs["pausedUntil"] as? String, "2026-10-30T00:00:00Z")
        let summary = try await h.map("getReminder", ["id": id])
        XCTAssertEqual((summary["nextOccurrence"] as? WireMap)?["scheduledAt"] as? String, "2026-10-30T13:00:00Z")

        _ = try await h.call("setPausedUntil", ["until": "9999-12-31T23:59:59Z"])
        XCTAssertTrue(h.platform.applied.isEmpty, "an indefinite pause registers nothing")

        let resumed = try await h.map("setPausedUntil", ["until": NSNull()])
        XCTAssertTrue(resumed["pausedUntil"] is NSNull)
        XCTAssertEqual(h.platform.applied.count, 1)
    }

    func testWithoutAlarmAccessRemindersWaitForSetup() async throws {
        let h = Harness(authorization: .notDetermined)
        let saved = try await h.map("saveReminder", ["request": reminderRequest()])
        XCTAssertEqual((saved["capabilityResult"] as? WireMap)?["status"] as? String, "needs_action")
        XCTAssertEqual((saved["reminder"] as? WireMap)?["effectiveState"] as? String, "needs_setup")
        XCTAssertTrue(h.platform.applied.isEmpty)

        let capability = try await h.map("getCapabilitySnapshot")
        XCTAssertEqual(capability["overall"] as? String, "needs_action")
        let item = try XCTUnwrap((capability["items"] as? [WireMap])?.first)
        XCTAssertEqual(item["action"] as? String, "request_runtime")
    }

    func testPlayHandsTheReminderToDartOnce() async throws {
        let h = Harness()
        let saved = try await h.map("saveReminder", ["request": reminderRequest()])
        let id = try XCTUnwrap((saved["reminder"] as? WireMap)?["id"] as? String)
        let played = try await h.map("playDueSession", ["sessionId": id, "nonce": "n"])
        XCTAssertEqual(played["outcome"] as? String, "playing")
        let pending = try await h.map("takePendingMediaOpen")
        XCTAssertEqual(pending["reminderId"] as? String, id)
        let drained = try await h.map("takePendingMediaOpen")
        XCTAssertTrue(drained["reminderId"] is NSNull)

        let stats = try await h.map("getStatistics", ["rangeDays": 7])
        XCTAssertEqual(stats["completed"] as? Int, 1)
        XCTAssertEqual((stats["dailyBreakdown"] as? [Any])?.count, 7)
        await expectHostError("sessionId") { try await h.call("dismissDueSession", ["sessionId": "x", "nonce": "n"]) }
    }

    func testPreferencesPatchOnlyWhatIsSent() async throws {
        let h = Harness()
        _ = try await h.call("setPreferences", ["patch": ["languageTag": "en-SG", "defaultSnoozeMinutes": 5]])
        let cleared = try await h.map("setPreferences", ["patch": ["languageTag": NSNull()]])
        XCTAssertTrue(cleared["languageTag"] is NSNull)
        XCTAssertEqual(cleared["defaultSnoozeMinutes"] as? Int, 5)
        await expectHostError("themePreference") { try await h.call("setPreferences", ["patch": ["themePreference": "neon"]]) }
    }

    func testStatePersistsThroughTheFileStore() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("nudgio-store-\(UUID().uuidString)")
        let store = FileKernelStore(directory: directory)
        var state = KernelState()
        state.preferences.defaultSnoozeMinutes = 7
        state.folders = [FolderRecord(id: "f", parentId: nil, name: "Family", pinned: true)]
        try store.save(state)
        XCTAssertEqual(try FileKernelStore(directory: directory).load(), state)
    }
}
