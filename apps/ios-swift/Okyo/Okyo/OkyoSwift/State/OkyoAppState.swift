import Foundation
import Observation

enum AppTab: String, Hashable {
    case scan, library, settings
}

enum OkyoRoute: Hashable {
    case analysisLoading
    case resultSummary
    case recipeDetail
    case groceryList
}

@Observable
@MainActor
final class OkyoAppState {
    // MARK: - Onboarding
    var hasCompletedOnboarding: Bool = false

    // MARK: - Navigation
    var selectedTab: AppTab = .scan
    var scanPath: [OkyoRoute] = []

    // MARK: - Scan
    var scanSession: ScanSession? = nil
    var selectedMode: RecipeMode = .restaurantCopy

    // MARK: - Saved Recipes (in-memory; persist in a later pass)
    var savedRecipes: [Recipe] = []

    // MARK: - API
    var apiBaseURL: String = "http://192.168.1.115:8081"

    // MARK: - Onboarding Actions

    func completeOnboarding() {
        hasCompletedOnboarding = true
        selectedTab = .scan
    }

    func resetOnboarding() {
        hasCompletedOnboarding = false
    }

    // MARK: - Scan Session

    func beginScan(sessionId: String, source: ScanSource) {
        scanSession = ScanSession(
            sessionId: sessionId,
            status: nil,
            scan: nil,
            recipes: [],
            selectedRecipe: nil,
            failure: nil,
            source: source
        )
    }

    func writeScanSuccess(
        sessionId: String,
        scan: ScanResult,
        recipes: [Recipe],
        selectedRecipe: Recipe?,
        source: ScanSource
    ) {
        guard scanSession?.sessionId == sessionId else { return }
        scanSession = ScanSession(
            sessionId: sessionId,
            status: .success,
            scan: scan,
            recipes: recipes,
            selectedRecipe: selectedRecipe ?? recipes.first,
            failure: nil,
            source: source
        )
    }

    func writeScanFailure(
        sessionId: String,
        status: ScanStatus,
        failure: ScanFailure,
        source: ScanSource
    ) {
        guard scanSession?.sessionId == sessionId else { return }
        scanSession = ScanSession(
            sessionId: sessionId,
            status: status,
            scan: nil,
            recipes: [],
            selectedRecipe: nil,
            failure: failure,
            source: source
        )
    }

    func clearScan() {
        scanSession = nil
        scanPath.removeAll()
    }

    // MARK: - Navigation

    func navigateToLoading() {
        guard !scanPath.contains(.analysisLoading) else { return }
        scanPath.append(.analysisLoading)
    }

    func navigateToResult() {
        guard !scanPath.contains(.resultSummary) else { return }
        scanPath.append(.resultSummary)
    }

    func navigateToRecipeDetail() {
        guard !scanPath.contains(.recipeDetail) else { return }
        scanPath.append(.recipeDetail)
    }

    func navigateToGroceryList() {
        guard !scanPath.contains(.groceryList) else { return }
        scanPath.append(.groceryList)
    }

    func resetScanNavigation() {
        scanPath.removeAll()
        scanSession = nil
    }

    // MARK: - Saved Recipes

    func saveRecipe(_ recipe: Recipe) {
        guard !savedRecipes.contains(where: { $0.id == recipe.id }) else { return }
        savedRecipes.insert(recipe, at: 0)
    }

    func removeRecipe(id: String) {
        savedRecipes.removeAll { $0.id == id }
    }

    func clearAllData() {
        savedRecipes.removeAll()
        clearScan()
    }

    // MARK: - Helpers

    func generateSessionId(source: ScanSource) -> String {
        let ts = Int(Date().timeIntervalSince1970 * 1000)
        let rand = Int.random(in: 10000...99999)
        return "scan-\(source.rawValue)-\(ts)-\(rand)"
    }
}
