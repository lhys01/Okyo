import SwiftUI

@main
struct OkyoSwiftApp: App {
    @State private var appState = OkyoAppState()

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environment(appState)
        }
    }
}
