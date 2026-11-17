import Foundation
import XCTest
@testable import NudgioKernel

/// The Swift third of the host contract: the same method table as Dart and
/// Kotlin (`contract/host_methods.json`), and DTOs with at least every key the
/// shared fixtures carry.
final class ContractTests: XCTestCase {
    func json(_ relative: String) throws -> Any {
        let url = repositoryFile(relative)
        guard FileManager.default.fileExists(atPath: url.path) else {
            #if os(iOS)
            // A simulator test bundle may not see the source checkout.
            throw XCTSkip("\(relative) is not readable from the simulator")
            #else
            XCTFail("missing \(url.path)")
            return [:]
            #endif
        }
        return try JSONSerialization.jsonObject(with: Data(contentsOf: url))
    }

    func testMethodTableMatchesTheContractFile() throws {
        let contract = try XCTUnwrap(try json("contract/host_methods.json") as? [String: Any])
        let methods = try XCTUnwrap(contract["methods"] as? [String: Any])
        XCTAssertEqual(Set(methods.keys), Set(HostDispatcher.methods))
        XCTAssertEqual(HostDispatcher.methods.count, Set(HostDispatcher.methods).count)
        XCTAssertEqual(contract["hostChannel"] as? String, HostDispatcher.hostChannel)
        XCTAssertEqual(contract["eventChannel"] as? String, HostDispatcher.eventChannel)
        XCTAssertEqual((contract["contractVersion"] as? NSNumber)?.intValue, HostDispatcher.contractVersion)
    }

    func testEveryMethodIsAnsweredOrDeclinedWithAnEnvelope() async throws {
        let h = Harness()
        for method in HostDispatcher.methods {
            do {
                _ = try await h.call(method, ["id": "x", "sessionId": "x", "nonce": "n", "requestJson": "{\"action\":\"list\"}"])
            } catch let error as HostError {
                // Validation for the dummy arguments, or a declared gap; never "unknown method".
                XCTAssertNotEqual(error.messageKey == "error.unexpected" && error.field == method && error.category == .internal, true,
                                  "\(method) fell through to the unknown-method branch")
                XCTAssertNotNil(error.envelope["correlationId"])
            }
        }
        await expectHostError("nope", code: "MR_INTERNAL_FAILED_SAFE") { try await h.call("nope") }
    }

    func assertCovers(_ fixture: String, _ produced: WireMap, file: StaticString = #filePath, line: UInt = #line) throws {
        let expected = try XCTUnwrap(try json("contract/fixtures/\(fixture).json") as? [String: Any])
        let missing = Set(expected.keys).subtracting(produced.keys)
        XCTAssertTrue(missing.isEmpty, "\(fixture) is missing \(missing.sorted())", file: file, line: line)
    }

    func assertFirstItemCovers(_ fixture: String, _ produced: WireMap, file: StaticString = #filePath, line: UInt = #line) throws {
        let expected = try XCTUnwrap(try json("contract/fixtures/\(fixture).json") as? [String: Any])
        let expectedItem = try XCTUnwrap((expected["items"] as? [[String: Any]])?.first)
        let producedItem = try XCTUnwrap((produced["items"] as? [WireMap])?.first)
        let missing = Set(expectedItem.keys).subtracting(producedItem.keys)
        XCTAssertTrue(missing.isEmpty, "\(fixture) item is missing \(missing.sorted())", file: file, line: line)
    }

    func testDTOsCarryEveryFixtureKey() async throws {
        let h = Harness()
        try assertCovers("startup_snapshot", try await h.map("getStartupSnapshot"))
        try assertCovers("preferences", try await h.map("getPreferences"))

        let token = try h.stage("clip.mp4", bytes: Data(repeating: 7, count: 2048))
        let media = try await h.map("beginMediaImport", ["request": ["sourceUri": token, "mimeType": "video/mp4", "displayName": "Stretch routine.mp4"]])
        let mediaId = try XCTUnwrap(media["id"] as? String)
        let mediaPage = try await h.map("listMedia", ["query": [String: Any]()])
        try assertCovers("media_page", mediaPage)
        try assertFirstItemCovers("media_page", mediaPage)

        let saved = try await h.map("saveReminder", ["request": reminderRequest(extra: ["mediaId": mediaId])])
        let detail = try XCTUnwrap(saved["reminder"] as? WireMap)
        try assertCovers("reminder_detail", detail)
        let page = try await h.map("listReminders")
        try assertCovers("reminder_page", page)
        try assertFirstItemCovers("reminder_page", page)

        let action = try await h.map("snoozeDueSession", ["sessionId": detail["id"]!, "minutes": 10, "nonce": "n"])
        try assertCovers("action_result", action)
        try assertCovers("error_envelope", HostError.validation("label").envelope)
    }

    func testInstantsAreWholeSecondUTC() {
        XCTAssertEqual(WireInstant.format(Date(timeIntervalSince1970: 1_793_149_200.75)), "2026-10-28T01:00:00Z")
        XCTAssertEqual(WireInstant.parse("2026-10-28T01:00:00.500Z")?.timeIntervalSince1970, 1_793_149_200.5)
    }
}
