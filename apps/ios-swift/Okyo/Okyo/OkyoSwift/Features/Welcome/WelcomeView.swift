import SwiftUI

struct WelcomeView: View {
    @Environment(OkyoAppState.self) private var appState

    var body: some View {
        ZStack {
            OkyoTheme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Brand
                Text("OKYO")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(OkyoTheme.primary)
                    .kerning(2)
                    .padding(.bottom, 28)

                // Hero card
                OkyoCard {
                    VStack(alignment: .leading, spacing: 0) {
                        // Illustration placeholder
                        ZStack {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(OkyoTheme.cream)
                                .frame(height: 140)
                            VStack(spacing: 4) {
                                Text("$31.60")
                                    .font(.system(size: 28, weight: .black))
                                    .foregroundStyle(OkyoTheme.green)
                                Text("saved")
                                    .font(.system(size: 12, weight: .black))
                                    .foregroundStyle(OkyoTheme.body)
                                    .textCase(.uppercase)
                            }
                            .padding(20)
                            .background(OkyoTheme.card)
                            .clipShape(Circle())
                            .overlay(
                                Circle().stroke(OkyoTheme.primary, lineWidth: 4)
                            )
                        }
                        .padding(.bottom, 20)

                        Text("Turn a food photo into a homemade recipe.")
                            .font(.system(size: 32, weight: .black))
                            .foregroundStyle(OkyoTheme.charcoal)
                            .lineSpacing(4)
                            .padding(.bottom, 14)

                        Text("Scan a dish, get the recipe, see what it costs to make at home.")
                            .font(.system(size: 17))
                            .foregroundStyle(OkyoTheme.body)
                            .lineSpacing(5)
                    }
                }
                .padding(.horizontal, OkyoTheme.screenPadding)

                Spacer()

                // CTA
                VStack(spacing: 12) {
                    OkyoPrimaryButton(label: "Scan a Meal") {
                        appState.completeOnboarding()
                    }
                }
                .padding(.horizontal, OkyoTheme.screenPadding)
                .padding(.bottom, 40)
            }
        }
    }
}

#Preview {
    WelcomeView()
        .environment(OkyoAppState())
}
