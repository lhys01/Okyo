import SwiftUI
import PhotosUI
import UIKit

struct ScanView: View {
    @Environment(OkyoAppState.self) private var appState
    @State private var photosPickerItem: PhotosPickerItem? = nil
    @State private var isProcessingPhoto = false

    var body: some View {
        ZStack {
            OkyoTheme.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: OkyoTheme.sectionGap) {
                    // Hero copy
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Turn a food photo into a homemade recipe.")
                            .font(.system(size: 38, weight: .black))
                            .foregroundStyle(OkyoTheme.charcoal)
                            .lineSpacing(2)

                        Text("Upload a food photo. Okyo makes a recipe from what it can see.")
                            .font(.system(size: 17))
                            .foregroundStyle(OkyoTheme.body)
                            .lineSpacing(5)
                    }
                    .padding(.top, 18)

                    // Scan card
                    OkyoCard {
                        VStack(spacing: 0) {
                            // Illustration area
                            ZStack {
                                RoundedRectangle(cornerRadius: 16)
                                    .fill(OkyoTheme.cream)
                                    .frame(height: 160)
                                Image(systemName: "fork.knife.circle.fill")
                                    .font(.system(size: 64))
                                    .foregroundStyle(OkyoTheme.primary.opacity(0.3))
                            }
                            .padding(.bottom, 18)

                            // Action buttons
                            VStack(spacing: 12) {
                                // Take photo
                                Button {
                                    Task { await takeCameraPhoto() }
                                } label: {
                                    HStack(spacing: 12) {
                                        Image(systemName: "camera.fill")
                                            .font(.system(size: 20))
                                            .foregroundStyle(.white)
                                        Text("Take photo")
                                            .font(.system(size: 18, weight: .black))
                                            .foregroundStyle(.white)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 60)
                                    .background(OkyoTheme.primary)
                                    .clipShape(RoundedRectangle(cornerRadius: OkyoTheme.buttonRadius))
                                    .shadow(color: OkyoTheme.primary.opacity(0.22), radius: 12, x: 0, y: 6)
                                }
                                .buttonStyle(.plain)
                                .disabled(isProcessingPhoto)

                                // Upload from photos
                                PhotosPicker(selection: $photosPickerItem, matching: .images) {
                                    HStack(spacing: 12) {
                                        Image(systemName: "photo.on.rectangle")
                                            .font(.system(size: 20))
                                            .foregroundStyle(OkyoTheme.primary)
                                        Text(isProcessingPhoto ? "Processing…" : "Upload food photo")
                                            .font(.system(size: 18, weight: .black))
                                            .foregroundStyle(OkyoTheme.primary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 60)
                                    .background(OkyoTheme.card)
                                    .clipShape(RoundedRectangle(cornerRadius: OkyoTheme.buttonRadius))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: OkyoTheme.buttonRadius)
                                            .stroke(OkyoTheme.primary, lineWidth: 1.5)
                                    )
                                }
                                .buttonStyle(.plain)
                                .disabled(isProcessingPhoto)

                                // Demo scan
                                Button {
                                    Task { await startScan(source: .mock, imagePayload: nil) }
                                } label: {
                                    HStack(spacing: 12) {
                                        Image(systemName: "sparkles")
                                            .font(.system(size: 20))
                                            .foregroundStyle(OkyoTheme.primary)
                                        Text("Try demo scan")
                                            .font(.system(size: 18, weight: .black))
                                            .foregroundStyle(OkyoTheme.primary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 60)
                                    .background(OkyoTheme.card)
                                    .clipShape(RoundedRectangle(cornerRadius: OkyoTheme.buttonRadius))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: OkyoTheme.buttonRadius)
                                            .stroke(OkyoTheme.primary, lineWidth: 1.5)
                                    )
                                }
                                .buttonStyle(.plain)
                                .disabled(isProcessingPhoto)
                            }
                        }
                    }

                    // Recent saved recipes
                    if !appState.savedRecipes.isEmpty {
                        recentSection
                    }
                }
                .padding(.horizontal, OkyoTheme.screenPadding)
                .padding(.bottom, 160)
            }
        }
        .navigationTitle("")
        .navigationBarHidden(true)
        .onChange(of: photosPickerItem) { _, item in
            guard let item else { return }
            isProcessingPhoto = true
            Task {
                await handlePhotosPicker(item)
                photosPickerItem = nil
                isProcessingPhoto = false
            }
        }
    }

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent")
                    .font(.system(size: 22, weight: .black))
                    .foregroundStyle(OkyoTheme.charcoal)
                Spacer()
                Button {
                    appState.selectedTab = .library
                } label: {
                    Text("See all")
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(OkyoTheme.primary)
                }
            }

            if let recipe = appState.savedRecipes.first {
                Button {
                    appState.scanSession = ScanSession(
                        sessionId: "saved-\(recipe.id)",
                        status: .success,
                        scan: nil,
                        recipes: [recipe],
                        selectedRecipe: recipe,
                        failure: nil,
                        source: .mock
                    )
                    appState.selectedMode = recipe.mode
                    appState.scanPath.append(.recipeDetail)
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
                                    .lineLimit(1)
                                Text("Saved recipe")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(OkyoTheme.body)
                                HStack(spacing: 4) {
                                    Image(systemName: "dollarsign.circle.fill")
                                        .font(.system(size: 14))
                                        .foregroundStyle(OkyoTheme.green)
                                    Text("Saved recipe")
                                        .font(.system(size: 13, weight: .heavy))
                                        .foregroundStyle(OkyoTheme.green)
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(OkyoTheme.greenSoft)
                                .clipShape(Capsule())
                                .padding(.top, 4)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(OkyoTheme.muted)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Photo Handling

    private func handlePhotosPicker(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let uiImage = UIImage(data: data) else {
            await startScan(source: .photos, imagePayload: ScanImagePayload(
                conversionError: "image_processing_failed"
            ))
            return
        }

        if let (base64, width, height, dataUrlSize) = compressImage(uiImage) {
            let dataUrl = "data:image/jpeg;base64,\(base64)"
            let payload = ScanImagePayload(
                dataUrl: dataUrl,
                fileName: "okyo-scan-upload.jpg",
                mimeType: "image/jpeg",
                width: width,
                height: height,
                dataUrlSizeBytes: dataUrlSize,
                source: .photos,
                placeholder: false
            )
            await startScan(source: .photos, imagePayload: payload)
        } else {
            let payload = ScanImagePayload(
                fileName: "okyo-scan-upload.jpg",
                mimeType: "image/jpeg",
                source: .photos,
                placeholder: false,
                conversionError: "image_payload_too_large"
            )
            await startScan(source: .photos, imagePayload: payload)
        }
    }

    private func takeCameraPhoto() async {
        // Camera access via UIImagePickerController is available in a future pass.
        // For now, treat the same as a missing photo and show an honest failure.
        await startScan(source: .camera, imagePayload: ScanImagePayload(
            source: .camera,
            placeholder: false,
            conversionError: "camera_unavailable_in_simulator"
        ))
    }

    // MARK: - Image Compression

    private func compressImage(_ uiImage: UIImage) -> (base64: String, width: Int, height: Int, dataUrlSize: Int)? {
        let maxWidth: CGFloat = 1400
        let maxDataUrlBytes = 12_000_000
        let qualities: [(compress: CGFloat, maxW: CGFloat)] = [
            (0.78, maxWidth),
            (0.64, 1200),
            (0.52, 1000),
        ]

        for (quality, targetW) in qualities {
            let scale = uiImage.size.width > targetW ? targetW / uiImage.size.width : 1.0
            let newSize = CGSize(
                width: uiImage.size.width * scale,
                height: uiImage.size.height * scale
            )
            let renderer = UIGraphicsImageRenderer(size: newSize)
            let resized = renderer.image { _ in uiImage.draw(in: CGRect(origin: .zero, size: newSize)) }
            guard let jpegData = resized.jpegData(compressionQuality: quality) else { continue }
            let base64 = jpegData.base64EncodedString()
            let prefix = "data:image/jpeg;base64,"
            let totalSize = prefix.count + base64.count
            if totalSize <= maxDataUrlBytes {
                return (base64, Int(newSize.width), Int(newSize.height), totalSize)
            }
        }
        return nil
    }

    // MARK: - Scan

    private func startScan(source: ScanSource, imagePayload: ScanImagePayload?) async {
        let sessionId = appState.generateSessionId(source: source)
        appState.beginScan(sessionId: sessionId, source: source)
        appState.navigateToLoading()

        do {
            let request = ScanRequest(source: source, mode: appState.selectedMode, image: imagePayload)
            let result = try await OkyoAPIClient.shared.scan(request)

            guard appState.scanSession?.sessionId == sessionId else { return }

            let recipes = result.recipes ?? (result.recipe.map { [$0] } ?? [])
            let status = result.status ?? .success

            if let scan = result.scan, ScanDecision.isUsableScan(status: status, scan: scan, recipes: recipes) {
                let selected = recipes.first(where: { $0.mode == appState.selectedMode }) ?? recipes.first
                appState.writeScanSuccess(sessionId: sessionId, scan: scan, recipes: recipes, selectedRecipe: selected, source: source)
            } else {
                let failStatus: ScanStatus = ScanDecision.shouldReject(status: status, scan: result.scan, recipes: recipes)
                    ? .rejected : .failed
                let failure = ScanFailure(
                    status: failStatus,
                    rejectionType: result.rejectionType ?? .aiFailed,
                    rejectionReason: result.rejectionReason ?? failureMessage(source: source)
                )
                appState.writeScanFailure(sessionId: sessionId, status: failStatus, failure: failure, source: source)
            }
        } catch {
            guard appState.scanSession?.sessionId == sessionId else { return }
            let msg = source == .mock
                ? "Demo scan unavailable. Check the API server."
                : (error as? AppError)?.errorDescription ?? "Okyo could not reach the scanner."
            let failure = ScanFailure(
                status: .failed,
                rejectionType: .aiFailed,
                rejectionReason: msg
            )
            appState.writeScanFailure(sessionId: sessionId, status: .failed, failure: failure, source: source)
        }
    }

    private func failureMessage(source: ScanSource) -> String {
        source == .mock
            ? "Demo scan unavailable."
            : "Okyo had trouble scanning this photo. Try again."
    }
}

#Preview {
    NavigationStack {
        ScanView()
    }
    .environment(OkyoAppState())
}
