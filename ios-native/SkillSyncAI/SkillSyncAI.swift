import ClerkKit
import ClerkKitUI
import SwiftUI

@main
struct SkillSyncAIApp: App {
    @UIApplicationDelegateAdaptor(SkillSyncAppDelegate.self) private var appDelegate

    init() {
        if AppConfiguration.isConfigured {
            Clerk.configure(publishableKey: AppConfiguration.clerkPublishableKey)
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.light)
        }
    }
}
