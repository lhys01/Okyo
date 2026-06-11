import Foundation

actor OkyoAPIClient {
    static let shared = OkyoAPIClient()

    // Single place for the base URL. Change in Settings to point to different host.
    private var baseURLString: String = "http://192.168.1.115:8081"

    func updateBaseURL(_ url: String) {
        baseURLString = url
    }

    private var baseURL: URL {
        URL(string: baseURLString) ?? URL(string: "http://192.168.1.115:8081")!
    }

    // MARK: - Public API

    func healthCheck() async throws -> HealthCheckResult {
        let url = baseURL.appendingPathComponent("health")
        return try await get(url: url, as: HealthCheckResult.self)
    }

    func scan(_ request: ScanRequest) async throws -> CreateScanResult {
        let url = baseURL.appendingPathComponent("v1/scans")
        return try await post(url: url, body: request, as: CreateScanResult.self)
    }

    // MARK: - Internal

    private func get<T: Decodable>(url: URL, as type: T.Type) async throws -> T {
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.timeoutInterval = 60
        return try await perform(req, as: type)
    }

    private func post<Body: Encodable, T: Decodable>(
        url: URL,
        body: Body,
        as type: T.Type
    ) async throws -> T {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        return try await perform(req, as: type)
    }

    private func perform<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let envelope = try JSONDecoder().decode(APIEnvelope<T>.self, from: data)
            return try envelope.unwrap()
        } catch let error as AppError {
            throw error
        } catch let error as URLError {
            throw AppError.networkError(urlErrorMessage(error))
        } catch {
            throw AppError.networkError(error.localizedDescription)
        }
    }

    private func urlErrorMessage(_ error: URLError) -> String {
        switch error.code {
        case .timedOut:
            return "The request timed out. Check the API server and try again."
        case .notConnectedToInternet, .networkConnectionLost:
            return "No network connection. Check Wi-Fi and try again."
        case .cannotConnectToHost, .cannotFindHost:
            return "Okyo could not reach the scanner. Check the API server and try again."
        default:
            return "Network error: \(error.localizedDescription)"
        }
    }
}
