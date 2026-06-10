import SwiftUI

struct ResultSummaryView: View {
    @Environment(OkyoAppState.self) private var appState
    @State private var dishNameEdit: String = ""
    @State private var isEditingDishName = false
    @State private var restaurantPriceInput: String = ""
    @State private var isSaved = false

    private var session: ScanSession? { appState.scanSession }
    private var scan: ScanResult? { session?.scan }
    private var recipe: Recipe? { session?.selectedRecipe ?? session?.recipes.first }
    private var isFailure: Bool { session?.isFailure ?? false }
    private var isDemo: Bool { session?.isDemo ?? false }

    private var displayDishName: String {
        if !dishNameEdit.isEmpty { return dishNameEdit }
        return scan?.dishName ?? scan?.bestGuessDishName ?? "Food"
    }

    private var isUncertain: Bool {
        let state = scan?.scanState
        return state == .foodPresentUncertainDish || state == .partialFood
    }

    private var confidencePercent: Int? {
        guard let c = scan?.confidence ?? appState.scanSession?.scan?.confidence, c > 0 else { return nil }
        return Int(c * 100)
    }

    private var userEnteredRestaurantPrice: Double? {
        guard let val = Double(restaurantPriceInput.filter({ $0.isNumber || $0 == "." })),
              val > 0 else { return nil }
        return val
    }

    var body: some View {
        ZStack {
            OkyoTheme.background.ignoresSafeArea()

            if isFailure {
                failureView
            } else if session?.isComplete == true || session != nil {
                resultView
            } else {
                emptyView
            }
        }
        .navigationBarBackButtonHidden(false)
        .onAppear {
            if let scan {
                dishNameEdit = scan.dishName
            }
        }
    }

    // MARK: - Result View

    private var resultView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: OkyoTheme.sectionGap) {
                // Dish name + confidence
                OkyoCard {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 8) {
                            if isUncertain {
                                OkyoStatusBadge(kind: .bestGuess)
                            } else if scan?.scanState == .clearFood {
                                OkyoStatusBadge(kind: .clear)
                            }
                            if let pct = confidencePercent {
                                Text("\(pct)% confident")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(OkyoTheme.muted)
                            }
                        }

                        // Dish name (editable)
                        if isEditingDishName {
                            TextField("Dish name", text: $dishNameEdit)
                                .font(.system(size: 28, weight: .black))
                                .foregroundStyle(OkyoTheme.charcoal)
                                .submitLabel(.done)
                                .onSubmit { isEditingDishName = false }
                        } else {
                            HStack {
                                Text(displayDishName)
                                    .font(.system(size: 28, weight: .black))
                                    .foregroundStyle(OkyoTheme.charcoal)
                                Spacer()
                                Button {
                                    isEditingDishName = true
                                } label: {
                                    Image(systemName: "pencil.circle.fill")
                                        .font(.system(size: 24))
                                        .foregroundStyle(OkyoTheme.muted)
                                }
                            }
                        }

                        if isUncertain {
                            Text("Best guess based on the photo. Does this look right?")
                                .font(.system(size: 15))
                                .foregroundStyle(OkyoTheme.body)

                            if let possible = scan?.possibleDishNames, !possible.isEmpty {
                                Text("Other possibilities: \(possible.prefix(3).joined(separator: ", "))")
                                    .font(.system(size: 14))
                                    .foregroundStyle(OkyoTheme.muted)
                            }
                        }
                    }
                }

                // Cost card
                OkyoCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Cost estimate")
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundStyle(OkyoTheme.muted)
                            .textCase(.uppercase)

                        if let cost = recipe?.estimatedHomemadeCost {
                            HStack {
                                Text("Estimated grocery cost")
                                    .font(.system(size: 16))
                                    .foregroundStyle(OkyoTheme.body)
                                Spacer()
                                Text(String(format: "$%.2f", cost))
                                    .font(.system(size: 20, weight: .black))
                                    .foregroundStyle(OkyoTheme.charcoal)
                            }
                        }

                        Divider()

                        // Savings — only shown if user enters restaurant price
                        VStack(alignment: .leading, spacing: 8) {
                            Text("What did you pay at the restaurant?")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(OkyoTheme.charcoal)

                            HStack {
                                Text("$")
                                    .font(.system(size: 18, weight: .black))
                                    .foregroundStyle(OkyoTheme.muted)
                                TextField("0.00", text: $restaurantPriceInput)
                                    .keyboardType(.decimalPad)
                                    .font(.system(size: 18, weight: .black))
                                    .foregroundStyle(OkyoTheme.charcoal)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(OkyoTheme.cream)
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                            if let paid = userEnteredRestaurantPrice,
                               let cost = recipe?.estimatedHomemadeCost,
                               paid > cost {
                                HStack {
                                    Image(systemName: "dollarsign.circle.fill")
                                        .foregroundStyle(OkyoTheme.green)
                                    Text("Estimated savings: \(String(format: "$%.2f", paid - cost))")
                                        .font(.system(size: 16, weight: .black))
                                        .foregroundStyle(OkyoTheme.green)
                                }
                                .padding(.top, 4)
                            } else {
                                Text("Add what you paid to estimate savings.")
                                    .font(.system(size: 14))
                                    .foregroundStyle(OkyoTheme.muted)
                            }
                        }
                    }
                }

                // Recipe CTA
                if recipe != nil {
                    VStack(spacing: 12) {
                        OkyoPrimaryButton(label: "View Recipe") {
                            appState.navigateToRecipeDetail()
                        }

                        if let r = recipe, !isSaved {
                            OkyoSecondaryButton(label: "Save Recipe") {
                                appState.saveRecipe(r)
                                isSaved = true
                            }
                        } else if isSaved {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(OkyoTheme.green)
                                Text("Saved to library")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(OkyoTheme.green)
                            }
                        }

                        Button {
                            appState.resetScanNavigation()
                        } label: {
                            Text("Scan another meal")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(OkyoTheme.muted)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, OkyoTheme.screenPadding)
            .padding(.top, OkyoTheme.sectionGap)
            .padding(.bottom, 60)
        }
    }

    // MARK: - Failure View

    private var failureView: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: session?.failure?.rejectionType == .notFood
                ? "xmark.circle.fill"
                : "arrow.clockwise.circle.fill"
            )
            .font(.system(size: 64))
            .foregroundStyle(OkyoTheme.muted)

            VStack(spacing: 10) {
                Text(session?.failure?.rejectionType == .notFood
                    ? "This doesn't look like food."
                    : "Couldn't scan this photo."
                )
                .font(.system(size: 24, weight: .black))
                .foregroundStyle(OkyoTheme.charcoal)
                .multilineTextAlignment(.center)

                if let reason = session?.failure?.rejectionReason {
                    Text(reason)
                        .font(.system(size: 16))
                        .foregroundStyle(OkyoTheme.body)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, OkyoTheme.screenPadding)

            VStack(spacing: 12) {
                OkyoPrimaryButton(label: "Try Another Photo") {
                    appState.resetScanNavigation()
                }
            }
            .padding(.horizontal, OkyoTheme.screenPadding)

            Spacer()
        }
    }

    // MARK: - Empty State (no active scan)

    private var emptyView: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "camera.viewfinder")
                .font(.system(size: 56))
                .foregroundStyle(OkyoTheme.muted)
            Text("No active scan.")
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(OkyoTheme.charcoal)
            OkyoSecondaryButton(label: "Start a Scan") {
                appState.resetScanNavigation()
            }
            .padding(.horizontal, OkyoTheme.screenPadding)
            Spacer()
        }
    }
}

#Preview("Result") {
    let state = OkyoAppState()
    NavigationStack {
        ResultSummaryView()
    }
    .environment(state)
}
