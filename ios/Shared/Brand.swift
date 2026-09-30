import SwiftUI

enum Brand {
    static let ink = Color(red: 45 / 255, green: 77 / 255, blue: 181 / 255)
    static let moon = Color(red: 186 / 255, green: 200 / 255, blue: 255 / 255)
    static let apricot = Color(red: 233 / 255, green: 181 / 255, blue: 142 / 255)
    static let ivory = Color(red: 247 / 255, green: 244 / 255, blue: 238 / 255)
    static let midnight = Color(red: 17 / 255, green: 20 / 255, blue: 29 / 255)
    static func accent(_ scheme: ColorScheme) -> Color { scheme == .dark ? moon : ink }
    static func background(_ scheme: ColorScheme) -> Color { scheme == .dark ? midnight : ivory }
}
