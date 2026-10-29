import Foundation

/// Where the kernel's state lives. Room and app-owned files are the source of
/// truth on Android; this is the iPhone equivalent (AGENTS.md hard rule).
public protocol KernelStore {
    func load() throws -> KernelState
    func save(_ state: KernelState) throws
}

/// One JSON document in Application Support, replaced atomically on every
/// write (write a temporary file, then rename), so a crash mid-write leaves
/// the previous state, never a torn one. On iPhone the file is
/// `NSFileProtectionComplete` (plan §9).
///
/// Why not Core Data: the plan suggested it, but a Codable document builds and
/// is tested on Linux CI with no Mac, and the data set (reminders, media
/// metadata, folders) is small. `KernelStore` keeps the choice reversible
/// (DL-122).
public final class FileKernelStore: KernelStore {
    public let directory: URL
    private var file: URL { directory.appendingPathComponent("kernel-state.json") }

    public init(directory: URL) {
        self.directory = directory
    }

    public func load() throws -> KernelState {
        guard FileManager.default.fileExists(atPath: file.path) else { return KernelState() }
        let state = try decoder.decode(KernelState.self, from: Data(contentsOf: file))
        guard state.schemaVersion <= KernelState.currentSchemaVersion else {
            // A newer app wrote this; refuse rather than drop fields we do not know.
            throw HostError(code: "MR_INTERNAL_FAILED_SAFE", messageKey: "error.updateRequired", category: .internal, field: "schemaVersion")
        }
        return state
    }

    public func save(_ state: KernelState) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try encoder.encode(state)
        #if os(iOS)
        try data.write(to: file, options: [.atomic, .completeFileProtection])
        #else
        try data.write(to: file, options: .atomic)
        #endif
    }

    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }()

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        return decoder
    }()
}

/// For tests and previews.
public final class InMemoryKernelStore: KernelStore {
    public private(set) var state: KernelState
    public private(set) var saveCount = 0

    public init(_ state: KernelState = KernelState()) {
        self.state = state
    }

    public func load() throws -> KernelState { state }

    public func save(_ state: KernelState) throws {
        self.state = state
        saveCount += 1
    }
}
