import Foundation

// MARK: - Enums

enum RecipeMode: String, Codable, CaseIterable, Hashable {
    case restaurantCopy = "Restaurant Copy"
    case budget = "Budget"
    case healthy = "Healthy"
}

enum ScanSource: String, Codable, Hashable {
    case camera, photos, mock
}

enum ScanStatus: String, Codable, Hashable {
    case success, partial, rejected, failed
}

enum ScanState: String, Codable, Hashable {
    case clearFood = "clear_food"
    case foodPresentUncertainDish = "food_present_uncertain_dish"
    case partialFood = "partial_food"
    case notFood = "not_food"
    case tooUnclear = "too_unclear"
}

enum ScanRejectionType: String, Codable, Hashable {
    case notFood = "not_food"
    case unclearImage = "unclear_image"
    case aiFailed = "ai_failed"
}

enum AiSource: String, Codable, Hashable {
    case openrouterAi = "openrouter_ai"
    case mockAi = "mock_ai"
    case fallbackAi = "fallback_ai"
}

// MARK: - Request Models

struct ScanRequest: Encodable {
    let source: ScanSource
    let mode: RecipeMode?
    let image: ScanImagePayload?
}

struct ScanImagePayload: Encodable {
    var dataUrl: String?
    var fileName: String?
    var mimeType: String?
    var width: Int?
    var height: Int?
    var sizeBytes: Int?
    var dataUrlSizeBytes: Int?
    var source: ScanSource?
    var placeholder: Bool?
    var conversionError: String?
}

// MARK: - API Response Models

struct ScanResult: Codable, Identifiable, Hashable {
    let id: String
    let dishName: String
    let bestGuessDishName: String?
    let bestGuessNote: String?
    let possibleDishNames: [String]?
    let scanState: ScanState?
    let restaurantStyle: String
    // NOTE: never display restaurantPrice as user-confirmed for real scans
    let restaurantPrice: Double
    let homemadeCost: Double
    let estimatedSavings: Double
    let confidence: Double
    let matchScore: Double
    let difficulty: String
    let modes: [RecipeMode]
    let recipeId: String
    let groceryListId: String
    let shareCardId: String
}

struct RecipeIngredient: Codable, Hashable {
    let name: String
    let quantity: String
    let pantryItem: Bool?
}

struct RecipeIngredientGroup: Codable, Hashable {
    let component: String
    let items: [RecipeIngredient]
}

struct CookingTerm: Codable, Hashable {
    let term: String
    let meaning: String
}

struct RecipeStep: Codable, Hashable {
    let text: String
    let timeEstimate: String?
    let visualCue: String?
    let whyItMatters: String?
    let safetyNote: String?
    let flavorBoost: String?
}

struct GroceryItem: Codable, Hashable {
    let name: String
    let quantity: String
    let category: String
    let pantryItem: Bool?
    let pantryStaple: Bool?
    let sourceIngredient: String?
    let shoppingNote: String?
}

struct Recipe: Codable, Identifiable, Hashable {
    let id: String
    let scanResultId: String
    let title: String
    let mode: RecipeMode
    let description: String
    let prepTimeMinutes: Int
    let cookTimeMinutes: Int
    let totalTimeMinutes: Int?
    let activeTimeMinutes: Int?
    let servings: Int
    let skillLevel: String?
    let difficulty: String
    let estimatedHomemadeCost: Double
    let estimatedSavings: Double
    let ingredients: [RecipeIngredient]
    let ingredientGroups: [RecipeIngredientGroup]?
    let steps: [String]
    let structuredSteps: [RecipeStep]?
    let substitutions: [String]
    let pantryNote: String
    let confidenceNote: String
    let mainIngredientsSummary: String?
    let equipment: [String]?
    let bestFor: String?
    let avoidMistake: String?
    let mistakeWarning: String?
    let storage: String?
    let groceryItems: [GroceryItem]?
    let spicePairings: [String]?
    let cookingTerms: [CookingTerm]?
}

struct GroceryList: Codable, Identifiable {
    let id: String
    let recipeId: String
    let title: String
    let items: [GroceryItem]
}

struct CreateScanResult: Decodable {
    let status: ScanStatus?
    let scan: ScanResult?
    let scanId: String?
    let recipe: Recipe?
    let recipes: [Recipe]?
    let note: String?
    let rejectionType: ScanRejectionType?
    let rejectionReason: String?
    let partialReason: String?
    let scanState: ScanState?
    let uploadedImage: Bool?
    let source: ScanSource
    let fallbackReason: String?
    let aiSource: AiSource?
    let confidence: Double?
}

struct HealthCheckResult: Decodable {
    let status: String
    let service: String
    let mode: String
    let realAiEnabled: Bool
    let timestamp: String
}

// MARK: - API Envelope

struct APIEnvelope<T: Decodable>: Decodable {
    let ok: Bool
    let data: T?
    let error: APIErrorBody?

    func unwrap() throws -> T {
        if ok, let data { return data }
        throw AppError.apiError(
            code: error?.code ?? "unknown",
            message: error?.message ?? "API request failed."
        )
    }
}

struct APIErrorBody: Decodable {
    let code: String
    let message: String
}

// MARK: - App Error

enum AppError: Error, LocalizedError {
    case networkError(String)
    case apiError(code: String, message: String)
    case decodingError(String)

    var errorDescription: String? {
        switch self {
        case .networkError(let msg):       return msg
        case .apiError(_, let msg):        return msg
        case .decodingError(let msg):      return msg
        }
    }
}

// MARK: - App-Side Session Models

struct ScanSession {
    let sessionId: String
    var status: ScanStatus?
    var scan: ScanResult?
    var recipes: [Recipe]
    var selectedRecipe: Recipe?
    var failure: ScanFailure?
    let source: ScanSource

    var isPending: Bool { status == nil }
    var isComplete: Bool { status != nil }
    var isSuccess: Bool { status == .success || status == .partial }
    var isFailure: Bool { status == .failed || status == .rejected }
    var isDemo: Bool { source == .mock }
}

struct ScanFailure {
    let status: ScanStatus
    let rejectionType: ScanRejectionType
    let rejectionReason: String
}

// MARK: - Scan Decision
// Mirrors TypeScript scanDecision.ts logic exactly.

enum ScanDecision {
    static func hasFoodEvidence(status: ScanStatus?, scan: ScanResult?, recipes: [Recipe]) -> Bool {
        let state = scan?.scanState
        let isFoodState = state == .clearFood
            || state == .foodPresentUncertainDish
            || state == .partialFood
        let hasName = isUsefulText(scan?.dishName) || isUsefulText(scan?.bestGuessDishName)
        return isFoodState || hasName || !recipes.isEmpty
    }

    static func isUsableScan(status: ScanStatus?, scan: ScanResult?, recipes: [Recipe]) -> Bool {
        if status == .success { return true }
        let food = hasFoodEvidence(status: status, scan: scan, recipes: recipes)
        if status == .partial && food { return true }
        return food && (scan != nil || !recipes.isEmpty)
    }

    static func shouldReject(status: ScanStatus?, scan: ScanResult?, recipes: [Recipe]) -> Bool {
        let food = hasFoodEvidence(status: status, scan: scan, recipes: recipes)
        return !food && (scan?.scanState == .notFood || status == .rejected)
    }

    static func shouldRetry(status: ScanStatus?, scan: ScanResult?, recipes: [Recipe]) -> Bool {
        let food = hasFoodEvidence(status: status, scan: scan, recipes: recipes)
        return !food && (scan?.scanState == .tooUnclear || status == .failed)
    }

    private static func isUsefulText(_ value: String?) -> Bool {
        guard let v = value?.trimmingCharacters(in: .whitespaces), !v.isEmpty else { return false }
        return !["unknown", "unknown dish", "unclear dish", "not food"].contains(v.lowercased())
    }
}
