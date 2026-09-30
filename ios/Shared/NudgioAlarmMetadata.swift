import AlarmKit
import Foundation

/// Synthetic presentation metadata only. No shared writable store or App Group.
struct NudgioAlarmMetadata: AlarmMetadata {
    let testID: String
}

enum TestAlarmIdentity {
    // Twenty base slots plus a dedicated one-time capacity probe. Never user IDs.
    static let baseIDs: [UUID] = (1...20).map { index in
        UUID(uuidString: String(format: "A8741140-9374-4874-B832-%012d", index))!
    }
    static let probeID = UUID(uuidString: "A8741140-9374-4874-B832-000000000021")!
    static let allIDs = Set(baseIDs + [probeID])

    static func validated(_ raw: String) throws -> UUID {
        guard let id = UUID(uuidString: raw), allIDs.contains(id) else {
            throw IdentityError.unknownTest
        }
        return id
    }

    enum IdentityError: Error { case unknownTest }
}
