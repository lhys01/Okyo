import SwiftUI

struct GroceryListView: View {
    @Environment(OkyoAppState.self) private var appState
    @State private var checkedItems: Set<String> = []

    private var recipe: Recipe? { appState.scanSession?.selectedRecipe ?? appState.scanSession?.recipes.first }

    private var buyItems: [GroceryItem] {
        recipe?.groceryItems?.filter { $0.pantryStaple != true && $0.pantryItem != true } ?? []
    }

    private var pantryItems: [GroceryItem] {
        recipe?.groceryItems?.filter { $0.pantryStaple == true || $0.pantryItem == true } ?? []
    }

    private var groupedBuyItems: [(category: String, items: [GroceryItem])] {
        let order = ["Produce", "Protein", "Bakery / Bread", "Dairy", "Sauces / Condiments",
                     "Noodles / Grains", "Pantry", "Spices", "Garnish", "Other"]
        let grouped = Dictionary(grouping: buyItems, by: { $0.category })
        return order.compactMap { cat in
            guard let items = grouped[cat], !items.isEmpty else { return nil }
            return (category: cat, items: items)
        }
    }

    var body: some View {
        ZStack {
            OkyoTheme.background.ignoresSafeArea()

            if recipe?.groceryItems?.isEmpty != false {
                emptyView
            } else {
                listContent
            }
        }
        .navigationTitle("Grocery List")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    shareList()
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundStyle(OkyoTheme.primary)
                }
            }
        }
    }

    private var listContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: OkyoTheme.sectionGap) {
                // Recipe name header
                if let title = recipe?.title {
                    Text(title)
                        .font(.system(size: 22, weight: .black))
                        .foregroundStyle(OkyoTheme.charcoal)
                        .padding(.top, OkyoTheme.sectionGap)
                }

                // Buy items by category
                ForEach(groupedBuyItems, id: \.category) { group in
                    OkyoCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(group.category)
                                .font(.system(size: 13, weight: .heavy))
                                .foregroundStyle(OkyoTheme.muted)
                                .textCase(.uppercase)

                            ForEach(group.items.indices, id: \.self) { i in
                                let item = group.items[i]
                                let key = "\(group.category)-\(item.name)"
                                HStack {
                                    Button {
                                        if checkedItems.contains(key) {
                                            checkedItems.remove(key)
                                        } else {
                                            checkedItems.insert(key)
                                        }
                                    } label: {
                                        Image(systemName: checkedItems.contains(key)
                                            ? "checkmark.circle.fill"
                                            : "circle"
                                        )
                                        .font(.system(size: 22))
                                        .foregroundStyle(checkedItems.contains(key)
                                            ? OkyoTheme.green
                                            : OkyoTheme.border
                                        )
                                    }
                                    .buttonStyle(.plain)

                                    Text(item.name)
                                        .font(.system(size: 16))
                                        .foregroundStyle(checkedItems.contains(key) ? OkyoTheme.muted : OkyoTheme.charcoal)
                                        .strikethrough(checkedItems.contains(key))
                                    Spacer()
                                    Text(item.quantity)
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundStyle(OkyoTheme.body)
                                }
                            }
                        }
                    }
                }

                // Pantry check
                if !pantryItems.isEmpty {
                    OkyoCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Pantry check")
                                .font(.system(size: 13, weight: .heavy))
                                .foregroundStyle(OkyoTheme.muted)
                                .textCase(.uppercase)

                            ForEach(pantryItems.indices, id: \.self) { i in
                                HStack {
                                    Image(systemName: "checkmark.circle")
                                        .font(.system(size: 20))
                                        .foregroundStyle(OkyoTheme.muted)
                                    Text(pantryItems[i].name)
                                        .font(.system(size: 15))
                                        .foregroundStyle(OkyoTheme.muted)
                                    Spacer()
                                    Text("pantry")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(OkyoTheme.muted)
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, OkyoTheme.screenPadding)
            .padding(.bottom, 60)
        }
    }

    private var emptyView: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "cart")
                .font(.system(size: 48))
                .foregroundStyle(OkyoTheme.muted)
            Text("No grocery list available.")
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(OkyoTheme.charcoal)
            Spacer()
        }
    }

    private func shareList() {
        guard let recipe else { return }
        let items = recipe.groceryItems ?? []
        let lines = items.filter { $0.pantryStaple != true }.map { "• \($0.name) — \($0.quantity)" }
        let text = "\(recipe.title) Grocery List\n\n" + lines.joined(separator: "\n") + "\n\nMade with Okyo"
        let av = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = scene.windows.first,
           let root = window.rootViewController {
            root.present(av, animated: true)
        }
    }
}

#Preview {
    NavigationStack {
        GroceryListView()
    }
    .environment(OkyoAppState())
}
