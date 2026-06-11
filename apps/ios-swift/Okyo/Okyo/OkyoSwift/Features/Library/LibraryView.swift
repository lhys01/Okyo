import SwiftUI

struct LibraryView: View {
    @Environment(OkyoAppState.self) private var appState
    @State private var searchText = ""

    private var filteredRecipes: [Recipe] {
        guard !searchText.isEmpty else { return appState.savedRecipes }
        return appState.savedRecipes.filter {
            $0.title.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        ZStack {
            OkyoTheme.background.ignoresSafeArea()

            if appState.savedRecipes.isEmpty {
                emptyView
            } else {
                listView
            }
        }
        .navigationTitle("Library")
    }

    private var listView: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Search
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(OkyoTheme.muted)
                    TextField("Search recipes", text: $searchText)
                        .font(.system(size: 16))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(OkyoTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(OkyoTheme.border, lineWidth: 1)
                )
                .padding(.top, OkyoTheme.sectionGap)

                if filteredRecipes.isEmpty {
                    Text("No recipes match your search.")
                        .font(.system(size: 16))
                        .foregroundStyle(OkyoTheme.muted)
                        .padding(.top, 40)
                } else {
                    ForEach(filteredRecipes) { recipe in
                        recipeRow(recipe)
                    }
                }
            }
            .padding(.horizontal, OkyoTheme.screenPadding)
            .padding(.bottom, 40)
        }
    }

    private func recipeRow(_ recipe: Recipe) -> some View {
        Button {
            appState.scanSession = ScanSession(
                sessionId: "library-\(recipe.id)",
                status: .success,
                scan: nil,
                recipes: [recipe],
                selectedRecipe: recipe,
                failure: nil,
                source: .mock
            )
            appState.selectedMode = recipe.mode
            appState.selectedTab = .scan
            DispatchQueue.main.async {
                appState.scanPath = [.recipeDetail]
            }
        } label: {
            OkyoCard {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 14)
                            .fill(OkyoTheme.cream)
                            .frame(width: 68, height: 68)
                        Image(systemName: "book.fill")
                            .font(.system(size: 26))
                            .foregroundStyle(OkyoTheme.primary)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(recipe.title)
                            .font(.system(size: 17, weight: .black))
                            .foregroundStyle(OkyoTheme.charcoal)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Text(recipe.mode.rawValue)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(OkyoTheme.primary)

                        Text(String(format: "~$%.2f to make", recipe.estimatedHomemadeCost))
                            .font(.system(size: 13))
                            .foregroundStyle(OkyoTheme.body)
                    }

                    Spacer()

                    Button {
                        appState.removeRecipe(id: recipe.id)
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 16))
                            .foregroundStyle(OkyoTheme.muted)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var emptyView: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "books.vertical")
                .font(.system(size: 56))
                .foregroundStyle(OkyoTheme.muted)
            Text("No saved recipes yet.")
                .font(.system(size: 22, weight: .black))
                .foregroundStyle(OkyoTheme.charcoal)
            Text("Save a recipe after scanning to see it here.")
                .font(.system(size: 16))
                .foregroundStyle(OkyoTheme.body)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            OkyoPrimaryButton(label: "Scan a Meal") {
                appState.selectedTab = .scan
            }
            .padding(.horizontal, OkyoTheme.screenPadding)
            Spacer()
        }
    }
}

#Preview {
    NavigationStack {
        LibraryView()
    }
    .environment(OkyoAppState())
}
