import Foundation

/// DL-080 action validation, ported from `ReminderActionRules.kt`; the shared
/// cases in `RulesTests` mirror `ReminderActionRulesTest.kt`.
public enum ActionRules {
    public static let maxUriLength = 2048
    public static let maxLabelLength = 40
    private static let blockedSchemes: Set<String> = [
        "javascript", "file", "content", "intent", "data", "about", "blob", "android.resource", "jar", "vbscript",
    ]

    public enum Result: Equatable {
        case ok(ReminderAction?)
        case invalid(field: String)
    }

    public static func validate(type: String?, uri: String?, label: String?) -> Result {
        guard let type, !type.trimmingCharacters(in: .whitespaces).isEmpty else { return .ok(nil) }
        guard type == "open_link" else { return .invalid(field: "action.type") }
        let trimmedUri = uri?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard isAllowedUri(trimmedUri) else { return .invalid(field: "action.uri") }
        let trimmedLabel = label?.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalLabel = (trimmedLabel?.isEmpty ?? true) ? nil : trimmedLabel
        if let finalLabel, finalLabel.count > maxLabelLength { return .invalid(field: "action.label") }
        return .ok(ReminderAction(uri: trimmedUri, label: finalLabel))
    }

    public static func isAllowedUri(_ uri: String) -> Bool {
        guard !uri.isEmpty, uri.count <= maxUriLength else { return false }
        if uri.unicodeScalars.contains(where: { CharacterSet.whitespacesAndNewlines.contains($0) || CharacterSet.controlCharacters.contains($0) }) {
            return false
        }
        guard let colon = uri.firstIndex(of: ":"), colon != uri.startIndex else { return false }
        let scheme = String(uri[..<colon])
        guard scheme.range(of: "^[a-zA-Z][a-zA-Z0-9+.-]*$", options: .regularExpression) != nil else { return false }
        let normalized = scheme.lowercased()
        guard !blockedSchemes.contains(normalized) else { return false }
        let rest = uri[uri.index(after: colon)...]
        guard !rest.isEmpty else { return false }
        switch normalized {
        case "http", "https":
            return !(host(of: uri) ?? "").isEmpty
        case "tel":
            return rest.filter(\.isNumber).count >= 3
        case "mailto":
            return rest.contains("@")
        default:
            return true
        }
    }

    /// The authority's host, as `java.net.URI.getHost` reads it for http(s).
    static func host(of uri: String) -> String? {
        guard let schemeEnd = uri.range(of: "://") else { return nil }
        var authority = uri[schemeEnd.upperBound...].prefix { !"/?#".contains($0) }
        if let at = authority.lastIndex(of: "@") { authority = authority[authority.index(after: at)...] }
        let host = authority.prefix { $0 != ":" }
        return host.isEmpty ? nil : String(host)
    }
}

/// Library folder constraints, ported from `FolderRules.kt`.
public enum FolderRules {
    public struct Violation: Error, Equatable {
        public let message: String
    }

    public static func name(_ value: String) throws -> String {
        let collapsed = value.precomposedStringWithCanonicalMapping
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
        guard (1...60).contains(collapsed.unicodeScalars.count) else { throw Violation(message: "Folder names need 1–60 characters.") }
        guard !collapsed.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else {
            throw Violation(message: "Folder names cannot contain control characters.")
        }
        return collapsed
    }

    static func key(_ value: String) throws -> String {
        try name(value).uppercased().lowercased()
    }

    public static func validate(_ folders: [FolderRecord]) throws {
        guard folders.count <= 500 else { throw Violation(message: "The library supports up to 500 folders.") }
        guard folders.filter(\.pinned).count <= 8 else { throw Violation(message: "You can pin up to eight folders.") }
        let byId = Dictionary(folders.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        guard byId.count == folders.count else { throw Violation(message: "Duplicate folder ID.") }
        var siblings = Set<String>()
        for folder in folders {
            let siblingKey = "\(folder.parentId ?? "")/\(try key(folder.name))"
            guard siblings.insert(siblingKey).inserted else { throw Violation(message: "A folder with that name already exists here.") }
            if let parent = folder.parentId {
                guard parent != folder.id, let parentFolder = byId[parent], parentFolder.parentId == nil else {
                    throw Violation(message: "Only one level of subfolders is supported.")
                }
            }
        }
    }
}
