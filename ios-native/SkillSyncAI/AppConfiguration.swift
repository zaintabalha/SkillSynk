import Foundation

enum AppConfiguration {
    static var clerkPublishableKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "ClerkPublishableKey") as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static var apiBaseURL: URL? {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: "SkillSyncAPIBaseURL") as? String,
            let url = URL(string: value),
            url.scheme == "https",
            url.host != nil
        else {
            return nil
        }
        return url
    }

    static var isConfigured: Bool {
        (clerkPublishableKey.hasPrefix("pk_live_") || clerkPublishableKey.hasPrefix("pk_test_"))
            && !clerkPublishableKey.contains("REPLACE_WITH")
    }

    static var apnsEnvironment: String {
        Bundle.main.object(forInfoDictionaryKey: "APNSEnvironment") as? String ?? "development"
    }
}
