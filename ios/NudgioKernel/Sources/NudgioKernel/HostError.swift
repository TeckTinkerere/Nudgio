import Foundation

/// The MR-08 `NativeErrorEnvelope`, Swift half. Kotlin's
/// `NativeErrorEnvelope.kt` and Dart's `toAppError` agree on this shape: the
/// four required layers (code, message key, category, correlation id) are
/// always present, and a raw error message, which could hold a path, is never
/// the reason a call failed.
public struct HostError: Error, Equatable {
    public enum Category: String {
        case validation, capability, storage, media, schedule, backup, security, `internal`
    }

    public let code: String
    public let messageKey: String
    public let category: Category
    public let retryable: Bool
    public let field: String?
    public let correlationId: String

    public init(code: String, messageKey: String, category: Category, retryable: Bool = false, field: String? = nil) {
        self.code = code
        self.messageKey = messageKey
        self.category = category
        self.retryable = retryable
        self.field = field
        correlationId = UUID().uuidString.lowercased()
    }

    public var envelope: WireMap {
        var map: WireMap = [
            "code": code,
            "messageKey": messageKey,
            "category": category.rawValue,
            "retryable": retryable,
            "correlationId": correlationId,
        ]
        if let field { map["field"] = field }
        return map
    }

    public static func == (lhs: HostError, rhs: HostError) -> Bool {
        lhs.code == rhs.code && lhs.messageKey == rhs.messageKey && lhs.category == rhs.category
            && lhs.retryable == rhs.retryable && lhs.field == rhs.field
    }

    // The same codes Kotlin uses for the same situations.

    static func validation(_ field: String, messageKey: String = "error.validationFailed", retryable: Bool = false) -> HostError {
        HostError(code: "MR_VALIDATION_FAILED", messageKey: messageKey, category: .validation, retryable: retryable, field: field)
    }

    static func unknownId(_ field: String = "id") -> HostError {
        validation(field, messageKey: "error.unexpected")
    }

    static func mediaUnavailable(_ field: String) -> HostError {
        HostError(code: "MR_MEDIA_UNAVAILABLE", messageKey: "error.mediaUnavailable", category: .media, field: field)
    }

    static func unsupportedType() -> HostError {
        HostError(code: "MR_MEDIA_UNSUPPORTED_TYPE", messageKey: "error.mediaUnsupportedType", category: .media, field: "unsupportedType")
    }

    static func storageInsufficient(_ field: String) -> HostError {
        HostError(code: "MR_STORAGE_INSUFFICIENT", messageKey: "error.storageInsufficient", category: .storage, retryable: true, field: field)
    }

    /// Declared contract this platform does not offer yet (iPhone backup, see
    /// DL-122). Same envelope as Kotlin's `rejectNotImplemented`.
    static func notImplemented(_ method: String) -> HostError {
        HostError(code: "MR_INTERNAL_FAILED_SAFE", messageKey: "error.notImplemented", category: .internal, field: method)
    }

    static func failedSafe(_ method: String) -> HostError {
        HostError(code: "MR_INTERNAL_FAILED_SAFE", messageKey: "error.unexpected", category: .internal, field: method)
    }
}
