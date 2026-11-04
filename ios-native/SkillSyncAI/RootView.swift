import ClerkKit
import ClerkKitUI
import SwiftUI

struct RootView: View {
    var body: some View {
        Group {
            if !AppConfiguration.isConfigured || AppConfiguration.apiBaseURL == nil {
                ConfigurationRequiredView()
            } else {
                AuthenticatedRootView()
                    .environment(Clerk.shared)
            }
        }
        .tint(SkillSyncTheme.forestLight)
        .environment(
            \.layoutDirection,
            Locale.current.language.languageCode?.identifier == "ar" ? .rightToLeft : .leftToRight
        )
    }
}

private struct AuthenticatedRootView: View {
    @Environment(Clerk.self) private var clerk
    @State private var selectedTab = 0
    @State private var roomRoute: String?

    var body: some View {
        Group {
            if !clerk.isLoaded {
                ProgressView("Loading your secure session…")
                    .tint(SkillSyncTheme.forestLight)
            } else if clerk.session == nil {
                AuthView()
            } else {
                TabView(selection: $selectedTab) {
                    DashboardView(openRoom: openRoom)
                        .tabItem { Label("Overview", systemImage: "circle.grid.2x2.fill") }
                        .tag(0)
                    MatchmakingView(openRoom: openRoom)
                        .tabItem { Label("Find a match", systemImage: "sparkles") }
                        .tag(1)
                    RoomsListView(openRoom: openRoom, selectedRoomId: $roomRoute)
                        .tabItem { Label("Learning rooms", systemImage: "book.closed.fill") }
                        .tag(2)
                    ProfileView()
                        .tabItem { Label("My profile", systemImage: "person.crop.circle") }
                        .tag(3)
                }
                .tint(SkillSyncTheme.forestLight)
                .onChange(of: clerk.session?.id) { _, newValue in
                    Task {
                        if newValue == nil { _ = await NotificationManager.shared.removeCurrentDevice() }
                        else { await NotificationManager.shared.registerCachedTokenIfAvailable() }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: .skillSyncOpenRoom)) { notification in
                    guard let roomId = notification.object as? String else { return }
                    roomRoute = roomId
                    selectedTab = 2
                }
                .task {
                    await NotificationManager.shared.registerCachedTokenIfAvailable()
                }
            }
        }
        .background(SkillSyncTheme.ivory.ignoresSafeArea())
    }

    private func openRoom(_ room: RoomSummary) {
        roomRoute = room.roomId
        selectedTab = 2
    }
}

struct ConfigurationRequiredView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: "leaf.fill")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(SkillSyncTheme.forestLight)
                .padding(16)
                .background(SkillSyncTheme.forestLight.opacity(0.10), in: RoundedRectangle(cornerRadius: 18))
            Text("Finish the iOS setup")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .foregroundStyle(SkillSyncTheme.forest)
            Text("Open ios-native/Configuration/SkillSync.xcconfig and replace the Clerk publishable key placeholder. Then build the SkillSyncAI scheme in Xcode.")
                .font(.body)
                .foregroundStyle(SkillSyncTheme.muted)
            Text("The app uses the production SkillSync API over HTTPS.")
                .font(.footnote.weight(.medium))
                .foregroundStyle(SkillSyncTheme.forestLight)
        }
        .padding(28)
        .frame(maxWidth: 560, maxHeight: .infinity, alignment: .leading)
        .background(SkillSyncTheme.ivory.ignoresSafeArea())
    }
}

struct RoomsListView: View {
    let openRoom: (RoomSummary) -> Void
    @Binding var selectedRoomId: String?
    @State private var rooms: [RoomSummary] = []
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    pageHeader("Your learning rooms", subtitle: "Keep building, teaching, and practicing together.")
                    PushPermissionCard()
                    if let error { StatusNotice(text: error, isError: true) }
                    if loading && rooms.isEmpty {
                        ProgressView().frame(maxWidth: .infinity).padding(40)
                    } else if rooms.isEmpty {
                        EmptyCard(icon: "books.vertical", title: "No rooms yet", detail: "Connect with a complementary learner to start your first shared room.")
                    } else {
                        ForEach(rooms) { room in
                            Button {
                                selectedRoomId = room.roomId
                                openRoom(room)
                            } label: { RoomSummaryCard(room: room) }
                                .buttonStyle(.plain)
                        }
                    }
                }
                .padding(20)
                .frame(maxWidth: 900)
                .frame(maxWidth: .infinity)
            }
            .background(SkillSyncTheme.ivory)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: Binding(
                get: { selectedRoomId != nil },
                set: { if !$0 { selectedRoomId = nil } }
            )) {
                if let selectedRoomId {
                    LearningRoomView(roomId: selectedRoomId)
                }
            }
            .task {
                await load()
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(3))
                    guard !Task.isCancelled else { break }
                    await load()
                }
            }
        }
    }

    @MainActor private func load() async {
        do {
            rooms = try await SkillSyncAPI.shared.get("skillsync/rooms")
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}

struct PushPermissionCard: View {
    @State private var status: String?

    var body: some View {
        BrandCard {
            HStack(spacing: 14) {
                Image(systemName: "bell.badge.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(SkillSyncTheme.terracotta)
                    .frame(width: 46, height: 46)
                    .background(SkillSyncTheme.coral.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                VStack(alignment: .leading, spacing: 4) {
                    Text("Stay in the learning loop").font(.headline).foregroundStyle(SkillSyncTheme.forest)
                    Text(status ?? "Enable notifications for partner messages and finished AI activities.")
                        .font(.footnote)
                        .foregroundStyle(SkillSyncTheme.muted)
                }
                Spacer(minLength: 6)
                Button {
                    Task {
                        do {
                            let allowed = try await NotificationManager.shared.requestPermission()
                            status = allowed ? "Notifications enabled." : "Enable notifications in iOS Settings to receive alerts."
                            if allowed { await NotificationManager.shared.registerCachedTokenIfAvailable() }
                        } catch { status = error.localizedDescription }
                    }
                } label: {
                    Image(systemName: "arrow.right")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 38, height: 38)
                        .background(SkillSyncTheme.forestLight, in: Circle())
                }
                .accessibilityLabel("Enable notifications")
            }
        }
    }
}

func pageHeader(_ title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: 7) {
        Eyebrow(title: "SkillSync AI · Learn together")
        Text(title)
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .foregroundStyle(SkillSyncTheme.forest)
            .fixedSize(horizontal: false, vertical: true)
        Text(subtitle).font(.subheadline).foregroundStyle(SkillSyncTheme.muted)
    }
    .padding(.vertical, 8)
}

struct RoomSummaryCard: View {
    let room: RoomSummary

    var body: some View {
        BrandCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label(room.partnerName, systemImage: "person.2.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(SkillSyncTheme.forestLight)
                    Spacer()
                    Text("\(room.progress)%")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(SkillSyncTheme.terracotta)
                }
                Text(room.projectTitle)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(SkillSyncTheme.forest)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(room.lastMessage ?? "Start a conversation.")
                    .font(.footnote)
                    .foregroundStyle(SkillSyncTheme.muted)
                    .lineLimit(2)
                ProgressView(value: Double(room.progress), total: 100)
                    .tint(SkillSyncTheme.forestLight)
            }
        }
    }
}

struct EmptyCard: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        BrandCard {
            VStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 24)).foregroundStyle(SkillSyncTheme.forestLight)
                Text(title).font(.headline).foregroundStyle(SkillSyncTheme.forest)
                Text(detail).font(.footnote).foregroundStyle(SkillSyncTheme.muted).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
    }
}
