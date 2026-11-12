import Foundation
import XCTest
@testable import NudgioKernel

/// A kernel over a temporary directory, an in-memory store and a recording
/// fake platform, with a fixed clock: 2026-10-28 09:00 in Singapore.
struct Harness {
    static let now = Date(timeIntervalSince1970: 1_793_149_200) // 2026-10-28T01:00:00Z
    static let zone = TimeZone(identifier: "Asia/Singapore")!

    let kernel: NudgioKernel
    let dispatcher: HostDispatcher
    let platform: UnavailablePlatform
    let store: InMemoryKernelStore
    let directories: KernelDirectories

    init(authorization: AlarmAuthorization = .authorized, now: Date = Harness.now) {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("nudgio-tests-\(UUID().uuidString)")
        directories = KernelDirectories(root: root.appendingPathComponent("support"), staging: root.appendingPathComponent("staging"))
        platform = UnavailablePlatform(authorization: authorization)
        store = InMemoryKernelStore()
        kernel = NudgioKernel(
            store: store, directories: directories, alarms: platform, platform: platform,
            environment: KernelEnvironment(appVersion: "3.0.0", buildVariant: "debug", now: { now }, zone: { Harness.zone })
        )
        dispatcher = HostDispatcher(kernel: kernel)
    }

    func call(_ method: String, _ arguments: [String: Any] = [:]) async throws -> Any {
        try await dispatcher.handle(method: method, arguments: arguments)
    }

    func map(_ method: String, _ arguments: [String: Any] = [:]) async throws -> WireMap {
        // Awaited first: XCTUnwrap's autoclosure cannot suspend.
        let value = try await call(method, arguments)
        return try XCTUnwrap(value as? WireMap)
    }

    /// Puts a file in staging the way a picker would, and returns its token.
    func stage(_ name: String, bytes: Data) throws -> String {
        try FileManager.default.createDirectory(at: directories.staging, withIntermediateDirectories: true)
        try bytes.write(to: directories.staging.appendingPathComponent(name))
        return "staged:\(name)"
    }
}

let standardSnooze: [String: Any] = ["defaultMinutes": 10, "allowCustom": true, "minimumMinutes": 1, "maximumMinutes": 60]
let gentleProfile = "00000000-0000-4000-8000-000000000001"

func reminderRequest(label: String = "Medicine", schedule: [String: Any] = ["type": "daily", "localTime": "21:00:00"],
                     extra: [String: Any] = [:]) -> [String: Any] {
    var request: [String: Any] = [
        "label": label, "schedule": schedule, "profileId": gentleProfile, "snooze": standardSnooze,
        "enabledIntent": true, "mediaId": NSNull(), "action": NSNull(),
    ]
    extra.forEach { request[$0.key] = $0.value }
    return request
}

/// The repository root, from this file's own path.
func repositoryFile(_ relative: String) -> URL {
    var url = URL(fileURLWithPath: #filePath)
    for _ in 0..<5 { url.deleteLastPathComponent() }
    return url.appendingPathComponent(relative)
}

func expectHostError(_ field: String?, code: String = "MR_VALIDATION_FAILED", file: StaticString = #filePath, line: UInt = #line,
                     _ body: () async throws -> Any) async {
    do {
        _ = try await body()
        XCTFail("expected \(code) for \(field ?? "-")", file: file, line: line)
    } catch let error as HostError {
        XCTAssertEqual(error.code, code, file: file, line: line)
        XCTAssertEqual(error.field, field, file: file, line: line)
    } catch {
        XCTFail("unexpected \(error)", file: file, line: line)
    }
}
