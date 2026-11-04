import BackgroundTasks
import ClerkKit
import UIKit
import UserNotifications

extension Notification.Name {
    static let skillSyncOpenRoom = Notification.Name("ai.skillsync.native.open-room")
}

@MainActor
final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    private let center = UNUserNotificationCenter.current()
    private let tokenDefaultsKey = "skillsync.apns.device-token"

    override private init() {
        super.init()
        center.delegate = self
    }

    func requestPermission() async throws -> Bool {
        let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
        }
        return granted
    }

    func registerCachedTokenIfAvailable() async {
        guard let token = UserDefaults.standard.string(forKey: tokenDefaultsKey), !token.isEmpty else { return }
        await register(token: token)
    }

    func receivedDeviceToken(_ data: Data) async {
        let token = data.map { String(format: "%02x", $0) }.joined()
        guard token.count >= 64 else { return }
        UserDefaults.standard.set(token, forKey: tokenDefaultsKey)
        await register(token: token)
    }

    func removeCurrentDevice() async -> Bool {
        guard let token = UserDefaults.standard.string(forKey: tokenDefaultsKey) else { return true }
        do {
            try await SkillSyncAPI.shared.sendNoContent(
                "skillsync/push/devices",
                method: "DELETE",
                body: PushDeviceInput(token: token, environment: AppConfiguration.apnsEnvironment)
            )
            UserDefaults.standard.removeObject(forKey: tokenDefaultsKey)
            return true
        } catch {
            return false
        }
    }

    func scheduleRoleSwap(roomId: String, after seconds: TimeInterval = 15 * 60, language: String = Locale.current.identifier) async {
        let content = UNMutableNotificationContent()
        content.title = language.lowercased().hasPrefix("ar") ? "حان وقت تبديل الأدوار" : "Time to switch teaching roles"
        content.body = language.lowercased().hasPrefix("ar")
            ? "ارجعا إلى غرفة SkillSync وتبادلا دور الشرح."
            : "Return to your SkillSync room and switch who teaches."
        content.sound = .default
        content.userInfo = ["roomId": roomId, "event": "role_swap"]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(5, seconds), repeats: false)
        try? await center.add(UNNotificationRequest(identifier: "roleswap-\(roomId)", content: content, trigger: trigger))
    }

    func cancelRoleSwap(roomId: String) {
        center.removePendingNotificationRequests(withIdentifiers: ["roleswap-\(roomId)"])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        UIApplication.shared.applicationState == .active ? [] : [.banner, .sound, .badge]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        if let roomId = response.notification.request.content.userInfo["roomId"] as? String {
            NotificationCenter.default.post(name: .skillSyncOpenRoom, object: roomId)
        }
    }

    private func register(token: String) async {
        guard Clerk.shared.session != nil else { return }
        do {
            try await SkillSyncAPI.shared.sendNoContent(
                "skillsync/push/devices",
                method: "POST",
                body: PushDeviceInput(token: token, environment: AppConfiguration.apnsEnvironment)
            )
        } catch {
            // APNs delivery remains retryable; the app keeps its token and re-registers on next launch.
        }
    }
}

@MainActor
final class SkillSyncAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        _ = NotificationManager.shared
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "ai.skillsync.native.refresh",
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            Self.scheduleRefresh()
            Task { @MainActor in
                do {
                    let _: Dashboard = try await SkillSyncAPI.shared.get("skillsync/dashboard")
                    refreshTask.setTaskCompleted(success: true)
                } catch {
                    refreshTask.setTaskCompleted(success: false)
                }
            }
        }
        Self.scheduleRefresh()
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in await NotificationManager.shared.receivedDeviceToken(deviceToken) }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // The app remains usable; APNs registration can be retried after permissions or network change.
    }

    private static func scheduleRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: "ai.skillsync.native.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
}
