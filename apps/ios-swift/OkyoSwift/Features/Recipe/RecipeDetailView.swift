import SwiftUI

struct RecipeDetailView: View {
    @Environment(OkyoAppState.self) private var appState
    @State private var isSaved = false

    private var recipe: Recipe? { appState.scanSession?.selectedRecipe ?? appState.scanSession?.recipes.first }

    var body: some View {
        ZStack {
            OkyoTheme.background.ignoresSafeArea()

            if let recipe {
                recipeContent(recipe)
            } else {
                emptyView
            }
        }
    }

    private func recipeContent(_ recipe: Recipe) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: OkyoTheme.sectionGap) {
                // Header
                OkyoCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(recipe.mode.rawValue)
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundStyle(OkyoTheme.primary)
                            .textCase(.uppercase)

                        Text(recipe.title)
                            .font(.system(size: 26, weight: .black))
                            .foregroundStyle(OkyoTheme.charcoal)

                        Text(recipe.description)
                            .font(.system(size: 15))
                            .foregroundStyle(OkyoTheme.body)

                        // Time / servings row
                        HStack(spacing: 16) {
                            timePill(label: "Prep", value: "\(recipe.prepTimeMinutes)m")
                            timePill(label: "Cook", value: "\(recipe.cookTimeMinutes)m")
                            if let total = recipe.totalTimeMinutes {
                                timePill(label: "Total", value: "\(total)m")
                            }
                            timePill(label: "Serves", value: "\(recipe.servings)")
                        }
                        .padding(.top, 4)

                        // Cost
                        HStack {
                            Image(systemName: "cart.fill")
                                .foregroundStyle(OkyoTheme.green)
                                .font(.system(size: 14))
                            Text("Estimated grocery cost: \(String(format: "$%.2f", recipe.estimatedHomemadeCost))")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(OkyoTheme.green)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(OkyoTheme.greenSoft)
                        .clipShape(Capsule())
                        .padding(.top, 4)
                    }
                }

                // Confidence note
                if !recipe.confidenceNote.isEmpty {
                    Text(recipe.confidenceNote)
                        .font(.system(size: 13))
                        .foregroundStyle(OkyoTheme.muted)
                        .padding(.horizontal, 4)
                }

                // Ingredients
                OkyoCard {
                    VStack(alignment: .leading, spacing: 12) {
                        OkyoSectionHeader(title: "Ingredients")
                        ForEach(recipe.ingredients.indices, id: \.self) { i in
                            let item = recipe.ingredients[i]
                            HStack {
                                Circle()
                                    .fill(item.pantryItem == true ? OkyoTheme.muted : OkyoTheme.primary)
                                    .frame(width: 7, height: 7)
                                Text(item.name)
                                    .font(.system(size: 16))
                                    .foregroundStyle(item.pantryItem == true ? OkyoTheme.muted : OkyoTheme.charcoal)
                                Spacer()
                                Text(item.quantity)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(OkyoTheme.body)
                            }
                        }

                        if !recipe.pantryNote.isEmpty {
                            Text(recipe.pantryNote)
                                .font(.system(size: 13))
                                .foregroundStyle(OkyoTheme.muted)
                                .padding(.top, 4)
                        }
                    }
                }

                // Steps
                OkyoCard {
                    VStack(alignment: .leading, spacing: 16) {
                        OkyoSectionHeader(title: "Steps")
                        ForEach(recipe.steps.indices, id: \.self) { i in
                            HStack(alignment: .top, spacing: 14) {
                                Text("\(i + 1)")
                                    .font(.system(size: 15, weight: .black))
                                    .foregroundStyle(.white)
                                    .frame(width: 28, height: 28)
                                    .background(OkyoTheme.primary)
                                    .clipShape(Circle())
                                Text(recipe.steps[i])
                                    .font(.system(size: 15))
                                    .foregroundStyle(OkyoTheme.charcoal)
                                    .lineSpacing(3)
                            }
                        }
                    }
                }

                // Actions
                VStack(spacing: 12) {
                    OkyoPrimaryButton(label: "View Grocery List") {
                        appState.navigateToGroceryList()
                    }

                    if !isSaved {
                        OkyoSecondaryButton(label: "Save Recipe") {
                            appState.saveRecipe(recipe)
                            isSaved = true
                        }
                    } else {
                        HStack {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(OkyoTheme.green)
                            Text("Saved to library").font(.system(size: 16, weight: .bold)).foregroundStyle(OkyoTheme.green)
                        }
                    }
                }
            }
            .padding(.horizontal, OkyoTheme.screenPadding)
            .padding(.top, OkyoTheme.sectionGap)
            .padding(.bottom, 60)
        }
    }

    private func timePill(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(OkyoTheme.charcoal)
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(OkyoTheme.muted)
                .textCase(.uppercase)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(OkyoTheme.cream)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var emptyView: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("No recipe loaded.")
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(OkyoTheme.charcoal)
            OkyoSecondaryButton(label: "Go Back") {
                appState.resetScanNavigation()
            }
            .padding(.horizontal, OkyoTheme.screenPadding)
            Spacer()
        }
    }
}

#Preview {
    NavigationStack {
        RecipeDetailView()
    }
    .environment(OkyoAppState())
}
