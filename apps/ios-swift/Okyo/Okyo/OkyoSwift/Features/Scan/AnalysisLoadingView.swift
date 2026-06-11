import SwiftUI

struct AnalysisLoadingView: View {
    @Environment(OkyoAppState.self) private var appState
    @State private var loadingPhase = 0
    @State private var dotCount = 0

    private let phases = [
        "Identifying the dish",
        "Estimating ingredients",
        "Building your homemade recipe",
        "Calculating cost estimate",
    ]

    var body: some View {
        ZStack {
            OkyoTheme.background.ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Animated icon
                ZStack {
                    Circle()
                        .fill(OkyoTheme.cream)
                        .frame(width: 120, height: 120)
                    Image(systemName: "fork.knife.circle.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(OkyoTheme.primary)
                        .symbolEffect(.pulse)
                }

                // Loading text
                VStack(spacing: 12) {
                    Text(phases[loadingPhase] + String(repeating: ".", count: dotCount + 1))
                        .font(.system(size: 22, weight: .black))
                        .foregroundStyle(OkyoTheme.charcoal)
                        .multilineTextAlignment(.center)
                        .animation(.easeInOut, value: loadingPhase)

                    Text("This takes about 10–30 seconds.")
                        .font(.system(size: 15))
                        .foregroundStyle(OkyoTheme.muted)
                }
                .padding(.horizontal, OkyoTheme.screenPadding)

                Spacer()

                // Cancel
                Button {
                    appState.resetScanNavigation()
                } label: {
                    Text("Cancel")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(OkyoTheme.muted)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 40)
            }
        }
        .navigationBarBackButtonHidden(true)
        .onAppear {
            // Navigate immediately if scan already completed before this view appeared
            if appState.scanSession?.isComplete == true {
                appState.navigateToResult()
            }
            startLoadingAnimation()
        }
        .onChange(of: appState.scanSession?.status) { _, newStatus in
            guard newStatus != nil else { return }
            guard !appState.scanPath.contains(.resultSummary) else { return }
            appState.navigateToResult()
        }
    }

    private func startLoadingAnimation() {
        // Cycle through loading phases
        Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { timer in
            withAnimation {
                loadingPhase = min(loadingPhase + 1, phases.count - 1)
            }
            if loadingPhase >= phases.count - 1 {
                timer.invalidate()
            }
        }
        // Animate dots
        Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { _ in
            dotCount = (dotCount + 1) % 3
        }
    }
}

#Preview {
    NavigationStack {
        AnalysisLoadingView()
    }
    .environment(OkyoAppState())
}
