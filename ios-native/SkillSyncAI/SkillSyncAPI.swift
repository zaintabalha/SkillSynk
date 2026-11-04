import ClerkKit
import Foundation

enum SkillSyncAPIError: LocalizedError {
    case missingConfiguration
    case signedOut
    case invalidResponse
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .missingConfiguration:
            return "Add the Clerk publishable key and API URL in SkillSync.xcconfig."
        case .signedOut:
            return "Sign in to continue."
        case .invalidResponse:
            return "The server returned an unreadable response."
        case let .server(_, message):
            return message
        }
    }
}

@MainActor
final class SkillSyncAPI {
    static let shared = SkillSyncAPI()
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(session: URLSession = .shared) {
        self.session = session
    }

    func get<T: Decodable>(_ path: String) async throws -> T {
        let data = try await perform(path, method: "GET")
        return try decoder.decode(T.self, from: data)
    }

    func send<T: Decodable, Body: Encodable>(_ path: String, method: String, body: Body) async throws -> T {
        let data = try await perform(path, method: method, body: encoder.encode(body))
        return try decoder.decode(T.self, from: data)
    }

    func sendNoContent<Body: Encodable>(_ path: String, method: String, body: Body) async throws {
        _ = try await perform(path, method: method, body: encoder.encode(body), acceptedStatuses: [200, 201, 202, 204])
    }

    func upload(to url: URL, data: Data, contentType: String) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SkillSyncAPIError.server(status: (response as? HTTPURLResponse)?.statusCode ?? 0, message: "The attachment could not be uploaded.")
        }
    }

    func authenticatedData(path: String) async throws -> Data {
        try await perform(path, method: "GET")
    }

    private func perform(
        _ path: String,
        method: String,
        body: Data? = nil,
        acceptedStatuses: Set<Int> = Set(200..<300)
    ) async throws -> Data {
        guard let baseURL = AppConfiguration.apiBaseURL else { throw SkillSyncAPIError.missingConfiguration }
        guard let token = try await Clerk.shared.auth.getToken(), !token.isEmpty else {
            throw SkillSyncAPIError.signedOut
        }
        let url = makeURL(path, baseURL: baseURL)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = (path.contains("/activities") || path.contains("/ai-messages")) ? 110 : 45
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(Locale.current.identifier.lowercased().hasPrefix("ar") ? "ar" : "en", forHTTPHeaderField: "Accept-Language")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw SkillSyncAPIError.invalidResponse }
        guard acceptedStatuses.contains(http.statusCode) else {
            let message = (try? decoder.decode(ApiErrorResponse.self, from: data).error) ?? "Request failed (\(http.statusCode))."
            throw SkillSyncAPIError.server(status: http.statusCode, message: message)
        }
        return data
    }

    private func makeURL(_ path: String, baseURL: URL) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        if path.hasPrefix("/api/") {
            components.path = path
            return components.url!
        }
        let prefix = baseURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let suffix = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.path = "/" + [prefix, suffix].filter { !$0.isEmpty }.joined(separator: "/")
        return components.url!
    }
}
