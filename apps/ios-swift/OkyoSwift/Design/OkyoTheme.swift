import SwiftUI

enum OkyoTheme {
    // MARK: - Colors (matches TypeScript colors in OkyoUI.tsx)
    static let background = Color(hex: "#fff8ef")
    static let card = Color.white
    static let cream = Color(hex: "#fff1df")
    static let creamDeep = Color(hex: "#f4dcc2")
    static let primary = Color(hex: "#e9552f")
    static let primaryDark = Color(hex: "#bd3f24")
    static let green = Color(hex: "#167247")
    static let greenSoft = Color(hex: "#e8f6ec")
    static let charcoal = Color(hex: "#211d19")
    static let body = Color(hex: "#5f574d")
    static let muted = Color(hex: "#8b8175")
    static let border = Color(hex: "#eadcc9")
    static let danger = Color(hex: "#9f3324")

    // MARK: - Spacing
    static let screenPadding: CGFloat = 22
    static let sectionGap: CGFloat = 18
    static let cardPadding: CGFloat = 16

    // MARK: - Corner radius
    static let cardRadius: CGFloat = 20
    static let buttonRadius: CGFloat = 18
    static let badgeRadius: CGFloat = 999
}

extension Color {
    init(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if h.hasPrefix("#") { h = String(h.dropFirst()) }
        guard h.count == 6, let value = UInt64(h, radix: 16) else {
            self = .clear
            return
        }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
