import Foundation
import XCTest
@testable import NudgioKernel

final class MediaTests: XCTestCase {
    func testImportCopiesHashesDeduplicatesAndDeletes() async throws {
        let h = Harness()
        let bytes = Data((0..<3_000_000).map { UInt8(truncatingIfNeeded: $0) })
        let first = try await h.map("beginMediaImport", ["request": ["sourceUri": try h.stage("a.jpg", bytes: bytes), "mimeType": "image/jpeg", "displayName": "Beach.jpg"]])
        XCTAssertEqual(first["title"] as? String, "Beach")
        XCTAssertEqual(first["sizeBytes"] as? String, "3000000")
        XCTAssertEqual(first["integrity"] as? String, "healthy")
        let source = try XCTUnwrap(first["sourceToken"] as? String)
        XCTAssertTrue(source.hasPrefix("file://"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: h.directories.staging.appendingPathComponent("a.jpg").path), "staging is consumed")

        // The same bytes again are the same asset (Android's duplicate-hash reuse).
        let again = try await h.map("beginMediaImport", ["request": ["sourceUri": try h.stage("b.jpg", bytes: bytes), "mimeType": "image/jpeg"]])
        XCTAssertEqual(again["id"] as? String, first["id"] as? String)

        let usage = try await h.map("getMediaStorageUsage")
        XCTAssertEqual(usage["itemCount"] as? Int, 1)
        XCTAssertEqual(usage["totalBytes"] as? String, "3000000")

        let id = try XCTUnwrap(first["id"] as? String)
        let saved = try await h.map("saveReminder", ["request": reminderRequest(extra: ["mediaId": id])])
        let reminderId = try XCTUnwrap((saved["reminder"] as? WireMap)?["id"] as? String)
        XCTAssertEqual(h.platform.applied.first?.secondary, .open, "media alarms offer Open")

        _ = try await h.call("deleteMedia", ["request": ["id": id, "cascadeDeleteReminders": false]])
        let orphan = try await h.map("getReminder", ["id": reminderId])
        XCTAssertEqual(orphan["enabledIntent"] as? Bool, false)
        XCTAssertEqual(orphan["mediaMissing"] as? Bool, true)
        await expectHostError("id", code: "MR_MEDIA_UNAVAILABLE") { try await h.call("getMedia", ["id": id]) }
    }

    func testImportRefusesTokensOutsideStagingAndUnsupportedTypes() async throws {
        let h = Harness()
        await expectHostError("sourceUri", code: "MR_MEDIA_UNAVAILABLE") {
            try await h.call("beginMediaImport", ["request": ["sourceUri": "staged:../kernel-state.json", "mimeType": "image/png"]])
        }
        await expectHostError("sourceUri", code: "MR_MEDIA_UNAVAILABLE") {
            try await h.call("beginMediaImport", ["request": ["sourceUri": "file:///etc/passwd", "mimeType": "image/png"]])
        }
        let token = try h.stage("doc.pdf", bytes: Data([1, 2, 3]))
        await expectHostError("unsupportedType", code: "MR_MEDIA_UNSUPPORTED_TYPE") {
            try await h.call("beginMediaImport", ["request": ["sourceUri": token, "mimeType": "application/pdf"]])
        }
    }

    func testImportEmitsMonotonicProgress() async throws {
        final class Box: @unchecked Sendable { var events: [WireMap] = []; let lock = NSLock() }
        let box = Box()
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("nudgio-progress-\(UUID().uuidString)")
        let directories = KernelDirectories(root: root.appendingPathComponent("s"), staging: root.appendingPathComponent("st"))
        let platform = UnavailablePlatform(authorization: .authorized)
        let kernel = NudgioKernel(store: InMemoryKernelStore(), directories: directories, alarms: platform, platform: platform,
                                  environment: KernelEnvironment(appVersion: "t", buildVariant: "debug")) { _, payload in
            box.lock.lock(); box.events.append(payload); box.lock.unlock()
        }
        try FileManager.default.createDirectory(at: directories.staging, withIntermediateDirectories: true)
        try Data(count: 2_500_000).write(to: directories.staging.appendingPathComponent("v.mp4"))
        _ = try await kernel.importMedia(WireReader(["sourceUri": "staged:v.mp4", "mimeType": "video/mp4"]))
        let sequences = box.events.compactMap { ($0["sequence"] as? String).flatMap(Int.init) }
        XCTAssertEqual(sequences, Array(1...sequences.count))
        XCTAssertEqual(box.events.last?["phase"] as? String, "ready")
    }

    func testFoldersMoveAndUndo() async throws {
        let h = Harness()
        let media = try await h.map("beginMediaImport", ["request": ["sourceUri": try h.stage("p.png", bytes: Data([9, 9])), "mimeType": "image/png"]])
        func command(_ body: [String: Any]) async throws -> [String: Any] {
            let data = try JSONSerialization.data(withJSONObject: body)
            let reply = try await h.call("libraryCommand", ["requestJson": String(decoding: data, as: UTF8.self)])
            return try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(try XCTUnwrap(reply as? String).utf8)) as? [String: Any])
        }
        var snapshot = try await command(["action": "list"])
        XCTAssertEqual(snapshot["unsorted"] as? Int, 1)
        let createId = UUID().uuidString
        snapshot = try await command(["action": "create", "commandId": createId, "revision": 0, "name": "  Family   trip "])
        let folder = try XCTUnwrap((snapshot["folders"] as? [[String: Any]])?.first)
        XCTAssertEqual(folder["name"] as? String, "Family trip")
        // A retried command is answered from its receipt, not applied twice.
        snapshot = try await command(["action": "create", "commandId": createId, "revision": 0, "name": "Family trip"])
        XCTAssertEqual((snapshot["folders"] as? [Any])?.count, 1)

        snapshot = try await command(["action": "move", "commandId": UUID().uuidString, "revision": 1,
                                      "items": [["id": media["id"]!, "version": media["entityVersion"]!]], "destination": folder["id"]!])
        XCTAssertEqual(snapshot["unsorted"] as? Int, 0)
        XCTAssertEqual(snapshot["canUndo"] as? Bool, true)
        snapshot = try await command(["action": "undo", "commandId": UUID().uuidString, "revision": 2])
        XCTAssertEqual(snapshot["unsorted"] as? Int, 1)

        await expectHostError("revision") {
            try await h.call("libraryCommand", ["requestJson": "{\"action\":\"create\",\"commandId\":\"\(UUID().uuidString)\",\"revision\":0,\"name\":\"x\"}"])
        }
    }
}

final class RulesTests: XCTestCase {
    // Mirrors ReminderActionRulesTest.kt and reminder_actions_test.dart.
    func testAllowedAndBlockedActionLinks() {
        for uri in ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "http://example.com", "spotify:track:6rqhFgbbKwnb9MLmUQDhG6",
                    "tel:+6591234567", "mailto:me@example.com", "geo:1.29,103.85?q=gym", "https://ja.wikipedia.org/wiki/日本語",
                    "duolingo://lesson"] {
            XCTAssertTrue(ActionRules.isAllowedUri(uri), uri)
        }
        for uri in ["", "javascript:alert(1)", "JavaScript:alert(1)", "file:///sdcard/secret.jpg",
                    "content://com.aslam.mediareminder.fileprovider/x", "data:text/html,hi", "https://", "https:///path",
                    "https://exa mple.com", "no scheme here", "youtube.com/watch?v=x", "tel:12", "mailto:nobody", "1http://x.com",
                    "https://example.com/" + String(repeating: "a", count: 2048)] {
            XCTAssertFalse(ActionRules.isAllowedUri(uri), uri)
        }
        XCTAssertEqual(ActionRules.validate(type: "open_link", uri: " https://x.co ", label: "  "), .ok(ReminderAction(uri: "https://x.co", label: nil)))
        XCTAssertEqual(ActionRules.validate(type: "other", uri: nil, label: nil), .invalid(field: "action.type"))
        XCTAssertEqual(ActionRules.validate(type: nil, uri: "https://x.co", label: nil), .ok(nil))
    }

    func testFolderRules() throws {
        XCTAssertEqual(try FolderRules.name("  a \t b  "), "a b")
        XCTAssertThrowsError(try FolderRules.name("   "))
        XCTAssertThrowsError(try FolderRules.validate([
            FolderRecord(id: "a", parentId: nil, name: "Work", pinned: false),
            FolderRecord(id: "b", parentId: "a", name: "Sub", pinned: false),
            FolderRecord(id: "c", parentId: "b", name: "Too deep", pinned: false),
        ]))
        XCTAssertThrowsError(try FolderRules.validate([
            FolderRecord(id: "a", parentId: nil, name: "Work", pinned: false),
            FolderRecord(id: "b", parentId: nil, name: "WORK", pinned: false),
        ]))
    }

    func testSHA256Vectors() {
        XCTAssertEqual(SHA256Hasher.hex(Data()), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        XCTAssertEqual(SHA256Hasher.hex(Data("abc".utf8)), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        var streamed = SHA256Hasher()
        for chunk in ["abcdbcdecdefdefgefghfghighijhi", "jkijkljklmklmnlmnomnopnopq"] { streamed.update(Data(chunk.utf8)) }
        XCTAssertEqual(streamed.finalize(), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1")
    }
}
