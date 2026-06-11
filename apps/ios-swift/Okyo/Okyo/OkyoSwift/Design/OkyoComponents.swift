import SwiftUI

// MARK: - Card

struct OkyoCard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .padding(OkyoTheme.cardPadding)
            .background(OkyoTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: OkyoTheme.cardRadius))
            .overlay(
                RoundedRectangle(cornerRadius: OkyoTheme.cardRadius)
                    .stroke(OkyoTheme.border, lineWidth: 1)
            )
            .shadow(color: Color(hex: "#7b5a38").opacity(0.08), radius: 12, x: 0, y: 8)
    }
}

// MARK: - Primary Button

struct OkyoPrimaryButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 18, weight: .black))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 60)
                .background(OkyoTheme.primary)
                .clipShape(RoundedRectangle(cornerRadius: OkyoTheme.buttonRadius))
                .shadow(color: OkyoTheme.primary.opacity(0.25), radius: 12, x: 0, y: 6)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Secondary Button

struct OkyoSecondaryButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 18, weight: .black))
                .foregroundStyle(OkyoTheme.primary)
                .frame(maxWidth: .infinity)
                .frame(height: 60)
                .background(OkyoTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: OkyoTheme.buttonRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: OkyoTheme.buttonRadius)
                        .stroke(OkyoTheme.primary, lineWidth: 1.5)
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Status Badge

struct OkyoStatusBadge: View {
    enum BadgeKind { case bestGuess, clear, noPrice }

    let kind: BadgeKind

    private var label: String {
        switch kind {
        case .bestGuess: return "Best guess"
        case .clear:     return "Identified"
        case .noPrice:   return "Add your price"
        }
    }

    private var color: Color {
        switch kind {
        case .bestGuess: return OkyoTheme.primary
        case .clear:     return OkyoTheme.green
        case .noPrice:   return OkyoTheme.muted
        }
    }

    var body: some View {
        Text(label)
            .font(.system(size: 13, weight: .heavy))
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(color.opacity(0.1))
            .clipShape(Capsule())
    }
}

// MARK: - Section Header

struct OkyoSectionHeader: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(size: 22, weight: .black))
            .foregroundStyle(OkyoTheme.charcoal)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Previews

#Preview("Buttons") {
    VStack(spacing: 16) {
        OkyoPrimaryButton(label: "Scan a Meal") {}
        OkyoSecondaryButton(label: "Upload food photo") {}
    }
    .padding()
    .background(OkyoTheme.background)
}

#Preview("Badges") {
    HStack(spacing: 8) {
        OkyoStatusBadge(kind: .bestGuess)
        OkyoStatusBadge(kind: .clear)
        OkyoStatusBadge(kind: .noPrice)
    }
    .padding()
    .background(OkyoTheme.background)
}
