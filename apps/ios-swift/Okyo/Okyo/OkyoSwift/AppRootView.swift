import SwiftUI

struct AppRootView: View {
    @Environment(OkyoAppState.self) private var appState

    var body: some View {
        if appState.hasCompletedOnboarding {
            MainTabView()
        } else {
            WelcomeView()
        }
    }
}

struct MainTabView: View {
    @Environment(OkyoAppState.self) private var appState

    var body: some View {
        @Bindable var appState = appState

        TabView(selection: $appState.selectedTab) {
            NavigationStack(path: $appState.scanPath) {
                ScanView()
                    .navigationDestination(for: OkyoRoute.self) { route in
                        switch route {
                        case .analysisLoading:
                            AnalysisLoadingView()
                        case .resultSummary:
                            ResultSummaryView()
                        case .recipeDetail:
                            RecipeDetailView()
                        case .groceryList:
                            GroceryListView()
                        }
                    }
            }
            .tabItem { Label("Scan", systemImage: "camera.fill") }
            .tag(AppTab.scan)

            NavigationStack {
                LibraryView()
            }
            .tabItem { Label("Library", systemImage: "books.vertical.fill") }
            .tag(AppTab.library)

            NavigationStack {
                SettingsView()
            }
            .tabItem { Label("Settings", systemImage: "gearshape.fill") }
            .tag(AppTab.settings)
        }
        .tint(OkyoTheme.primary)
    }
}

#Preview {
    AppRootView()
        .environment(OkyoAppState())
}
