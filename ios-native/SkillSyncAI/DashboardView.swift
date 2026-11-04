import SwiftUI

struct DashboardView: View {
    let openRoom: (RoomSummary) -> Void
    @State private var dashboard: Dashboard?
    @State private var error: String?
    @State private var loading = true

    private let columns = [GridItem(.adaptive(minimum: 145), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    pageHeader("Good learning is shared.", subtitle: "Trade what you know for what you want to learn.")

                    if let dashboard {
                        LazyVGrid(columns: columns, spacing: 12) {
                            StatTile(value: "\(dashboard.stats.activeRooms)", label: "Active rooms", icon: "book.closed")
                            StatTile(value: "\(dashboard.stats.connectionsMade)", label: "Connections", icon: "person.2")
                            StatTile(value: "\(dashboard.stats.projectsSubmitted)", label: "Projects shared", icon: "square.and.arrow.up")
                        }

                        HStack(spacing: 10) {
                            Image(systemName: dashboard.aiEnabled ? "sparkles" : "sparkles.slash")
                            Text(dashboard.aiEnabled ? "SkillSync AI is ready in your learning rooms." : "AI is temporarily unavailable; partner learning still works.")
                                .font(.footnote.weight(.medium))
                            Spacer()
                        }
                        .foregroundStyle(SkillSyncTheme.forestLight)
                        .padding(14)
                        .background(SkillSyncTheme.forestLight.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))

                        sectionHeader("Continue learning")
                        if dashboard.rooms.isEmpty {
                            EmptyCard(icon: "person.2", title: "Your first room starts with a match", detail: "Find a learner with complementary skills and start sharing what you know.")
                        } else {
                            ForEach(dashboard.rooms.prefix(3)) { room in
                                Button { openRoom(room) } label: { RoomSummaryCard(room: room) }
                                    .buttonStyle(.plain)
                            }
                        }

                        if !dashboard.recentActivity.isEmpty {
                            sectionHeader("Recent activity")
                            BrandCard {
                                VStack(alignment: .leading, spacing: 14) {
                                    ForEach(dashboard.recentActivity.prefix(5)) { item in
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(item.label).font(.subheadline.weight(.semibold)).foregroundStyle(SkillSyncTheme.forest)
                                            Text(item.detail).font(.footnote).foregroundStyle(SkillSyncTheme.muted)
                                        }
                                        if item.id != dashboard.recentActivity.prefix(5).last?.id {
                                            Divider().overlay(SkillSyncTheme.line)
                                        }
                                    }
                                }
                            }
                        }
                    } else if loading {
                        ProgressView().frame(maxWidth: .infinity).padding(48)
                    }

                    if let error { StatusNotice(text: error, isError: true) }
                }
                .padding(20)
                .frame(maxWidth: 920)
                .frame(maxWidth: .infinity)
            }
            .background(SkillSyncTheme.ivory)
            .toolbar(.hidden, for: .navigationBar)
            .refreshable { await load() }
            .task { await load() }
        }
    }

    @MainActor private func load() async {
        do {
            dashboard = try await SkillSyncAPI.shared.get("skillsync/dashboard")
            error = nil
        } catch let caughtError { error = caughtError.localizedDescription }
        loading = false
    }
}

private struct StatTile: View {
    let value: String
    let label: String
    let icon: String

    var body: some View {
        BrandCard {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: icon).foregroundStyle(SkillSyncTheme.terracotta)
                Text(value).font(.system(size: 30, weight: .bold, design: .rounded)).foregroundStyle(SkillSyncTheme.forest)
                Text(label).font(.caption.weight(.medium)).foregroundStyle(SkillSyncTheme.muted)
            }
        }
    }
}

func sectionHeader(_ title: String) -> some View {
    Text(title)
        .font(.title3.weight(.bold))
        .foregroundStyle(SkillSyncTheme.forest)
        .padding(.top, 2)
}
