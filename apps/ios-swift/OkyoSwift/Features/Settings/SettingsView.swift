import SwiftUI

struct SettingsView: View {
    @Environment(OkyoAppState.self) private var appState
    @State private var apiURLInput: String = ""
    @State private var healthStatus: String? = nil
    @State private var isCheckingHealth = false
    @State private var showDeleteConfirm = false
    @State private var showResetConfirm = false

    var body: some View {
        ZStack {
            OkyoTheme.background.ignoresSafeArea()

            List {
                // API section
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("API Base URL")
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundStyle(OkyoTheme.muted)
                            .textCase(.uppercase)

                        TextField("http://192.168.1.115:8081", text: $apiURLInput)
                            .font(.system(size: 15, weight: .medium, design: .monospaced))
                            .foregroundStyle(OkyoTheme.charcoal)
                            .autocapitalization(.none)
                            .keyboardType(.URL)
                            .submitLabel(.done)
                            .onSubmit { saveAPIURL() }
                    }
                    .padding(.vertical, 4)

                    Button {
                        saveAPIURL()
                        Task { await checkHealth() }
                    } label: {
                        HStack {
                            if isCheckingHealth {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .tint(OkyoTheme.primary)
                            } else {
                                Image(systemName: "network")
                            }
                            Text(isCheckingHealth ? "Checking…" : "Check API Health")
                        }
                        .foregroundStyle(OkyoTheme.primary)
                    }
                    .disabled(isCheckingHealth)

                    if let status = healthStatus {
                        Text(status)
                            .font(.system(size: 14))
                            .foregroundStyle(status.contains("ok") ? OkyoTheme.green : OkyoTheme.danger)
                    }
                } header: {
                    Text("API Connection")
                }

                // Data section
                Section {
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete Saved Data", systemImage: "trash")
                    }
                    .confirmationDialog(
                        "Delete all saved recipes and scan data?",
                        isPresented: $showDeleteConfirm,
                        titleVisibility: .visible
                    ) {
                        Button("Delete", role: .destructive) {
                            appState.clearAllData()
                        }
                        Button("Cancel", role: .cancel) {}
                    }

                    Button {
                        showResetConfirm = true
                    } label: {
                        Label("Reset Onboarding", systemImage: "arrow.counterclockwise")
                            .foregroundStyle(OkyoTheme.body)
                    }
                    .confirmationDialog(
                        "Reset onboarding? You will see the welcome screen again.",
                        isPresented: $showResetConfirm,
                        titleVisibility: .visible
                    ) {
                        Button("Reset") {
                            appState.resetOnboarding()
                        }
                        Button("Cancel", role: .cancel) {}
                    }
                } header: {
                    Text("Data")
                }

                // About section
                Section {
                    HStack {
                        Text("App")
                        Spacer()
                        Text("Okyo")
                            .foregroundStyle(OkyoTheme.muted)
                    }
                    HStack {
                        Text("Platform")
                        Spacer()
                        Text("iOS (SwiftUI)")
                            .foregroundStyle(OkyoTheme.muted)
                    }
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("0.1.0-swift-scaffold")
                            .foregroundStyle(OkyoTheme.muted)
                    }
                } header: {
                    Text("About")
                }
            }
            .scrollContentBackground(.hidden)
            .background(OkyoTheme.background)
        }
        .navigationTitle("Settings")
        .onAppear {
            apiURLInput = appState.apiBaseURL
        }
    }

    private func saveAPIURL() {
        let url = apiURLInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty else { return }
        appState.apiBaseURL = url
        Task { await OkyoAPIClient.shared.updateBaseURL(url) }
    }

    private func checkHealth() async {
        isCheckingHealth = true
        healthStatus = nil
        do {
            let result = try await OkyoAPIClient.shared.healthCheck()
            healthStatus = "✓ \(result.service) is ok (mode: \(result.mode), AI: \(result.realAiEnabled))"
        } catch {
            healthStatus = "✗ \((error as? AppError)?.errorDescription ?? error.localizedDescription)"
        }
        isCheckingHealth = false
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
    .environment(OkyoAppState())
}
