import Foundation

/// A `nudgio/host` value: what Flutter's standard message codec carries.
/// Maps are `[String: Any]` with `NSNull()` standing for a null field, exactly
/// as `FlutterStandardMessageCodec` produces and expects them.
public typealias WireMap = [String: Any]

/// Reads named arguments and request maps. Every accessor treats `NSNull`
/// as absent, and numbers arrive as `Int`, `Double` or `NSNumber`.
public struct WireReader {
    public let values: WireMap

    public init(_ value: Any?) {
        values = (value as? [String: Any]) ?? [:]
    }

    public func has(_ key: String) -> Bool {
        guard let value = values[key] else { return false }
        return !(value is NSNull)
    }

    public func string(_ key: String) -> String? {
        values[key] as? String
    }

    public func bool(_ key: String) -> Bool? {
        if let value = values[key] as? Bool { return value }
        if let number = values[key] as? NSNumber { return number.boolValue }
        return nil
    }

    public func int(_ key: String) -> Int? {
        switch values[key] {
        case let value as Int: return value
        case let value as Int64: return Int(value)
        case let value as Double where value == value.rounded(): return Int(value)
        case let value as NSNumber: return value.intValue
        default: return nil
        }
    }

    public func map(_ key: String) -> WireReader? {
        guard let value = values[key] as? [String: Any] else { return nil }
        return WireReader(value)
    }

    public func strings(_ key: String) -> [String]? {
        (values[key] as? [Any])?.compactMap { $0 as? String }
    }

    public func ints(_ key: String) -> [Int]? {
        guard let list = values[key] as? [Any] else { return nil }
        return list.compactMap { item in
            switch item {
            case let value as Int: return value
            case let value as Double where value == value.rounded(): return Int(value)
            case let value as NSNumber: return value.intValue
            default: return nil
            }
        }
    }
}

/// `nil` as the codec's null.
@inline(__always) func wireNull(_ value: Any?) -> Any {
    value ?? NSNull()
}

/// MR-08 instants: UTC ISO-8601 with no fractional seconds when they are zero,
/// matching Kotlin's `Instant.toString()` for whole seconds.
public enum WireInstant {
    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    public static func format(_ date: Date) -> String {
        // Whole seconds on the wire; the store keeps milliseconds.
        plain.string(from: Date(timeIntervalSince1970: date.timeIntervalSince1970.rounded(.down)))
    }

    public static func parse(_ value: String?) -> Date? {
        guard let value else { return nil }
        return plain.date(from: value) ?? fractional.date(from: value)
    }
}
