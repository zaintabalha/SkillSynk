import SwiftUI
import UserNotifications

struct LearningRoomView: View {
    let roomId: String
    @State private var room: LearningRoom?
    @State private var selectedSection = 0
    @State private var error: String?
    @State private var loading = true

    private let sections = ["Partner Chat", "SkillSync AI", "Activities", "Learning plan", "Video room"]

    var body: some View {
        Group {
            if let room {
                roomContent(room)
            } else if loading {
                ProgressView("Opening your learning room…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(SkillSyncTheme.ivory)
            } else {
                ContentUnavailableView(
                    "Room unavailable",
                    systemImage: "books.vertical",
                    description: Text(error ?? "This learning room could not be loaded.")
                )
                .background(SkillSyncTheme.ivory)
            }
        }
        .task(id: roomId) {
            await refresh()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(3))
                guard !Task.isCancelled else { break }
                await refresh()
            }
        }
    }

    @ViewBuilder private func roomContent(_ room: LearningRoom) -> some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Eyebrow(title: room.isDemo ? "Practice room" : "Learning room")
                        Text(room.projectTitle)
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundStyle(SkillSyncTheme.forest)
                            .lineLimit(2)
                    }
                    Spacer()
                    Text("\(room.progress)%")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundStyle(SkillSyncTheme.terracotta)
                }
                Text("You + \(room.partnerName)")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(SkillSyncTheme.muted)
                RoleSwapTimerCard(roomId: room.roomId)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            Picker("Room area", selection: $selectedSection) {
                ForEach(sections.indices, id: \.self) { index in
                    Text(sections[index]).tag(index)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)

            if let error {
                StatusNotice(text: error, isError: true).padding(.horizontal, 16)
            }

            Group {
                switch selectedSection {
                case 0:
                    ChatPanel(room: binding(for: room), channel: "partner")
                case 1:
                    ChatPanel(room: binding(for: room), channel: "ai")
                case 2:
                    ActivitiesView(room: binding(for: room))
                case 3:
                    LearningPlanView(room: room)
                default:
                    VideoRoomView(roomId: room.roomId, roomTitle: room.projectTitle)
                }
            }
            .frame(maxWidth: 1020, maxHeight: .infinity)
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SkillSyncTheme.ivory.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("SkillSync AI")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(SkillSyncTheme.forestLight)
            }
        }
    }

    @MainActor private func binding(for current: LearningRoom) -> Binding<LearningRoom> {
        Binding(
            get: { room ?? current },
            set: { room = $0 }
        )
    }

    @MainActor private func refresh() async {
        do {
            room = try await SkillSyncAPI.shared.get("skillsync/rooms/\(roomId)")
            error = nil
        } catch { error = error.localizedDescription }
        loading = false
    }
}

private struct RoleSwapTimerCard: View {
    let roomId: String
    @State private var endDate: Date?
    @State private var enabled = false
    @State private var showPermissionHint = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "timer").foregroundStyle(SkillSyncTheme.terracotta)
            VStack(alignment: .leading, spacing: 2) {
                Text("Role-switch timer").font(.caption.weight(.bold)).foregroundStyle(SkillSyncTheme.forest)
                if let endDate {
                    TimelineView(.periodic(from: .now, by: 1)) { timeline in
                        let remaining = max(0, Int(endDate.timeIntervalSince(timeline.date)))
                        Text(remaining > 0 ? String(format: "%02d:%02d remaining", remaining / 60, remaining % 60) : "Time to switch roles")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(SkillSyncTheme.muted)
                    }
                } else {
                    Text("15 minutes per teaching turn").font(.caption2).foregroundStyle(SkillSyncTheme.muted)
                }
            }
            Spacer()
            Button(enabled ? "Stop" : "Start 15 min") {
                Task { await toggle() }
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(enabled ? SkillSyncTheme.terracotta : SkillSyncTheme.forestLight)
            .buttonStyle(.bordered)
            .tint(SkillSyncTheme.forestLight.opacity(0.3))
        }
        .padding(11)
        .background(SkillSyncTheme.ivory, in: RoundedRectangle(cornerRadius: 14))
        .overlay(alignment: .bottomLeading) {
            if showPermissionHint {
                Text("Enable notifications in the room list to receive the turn alert.")
                    .font(.caption2)
                    .foregroundStyle(SkillSyncTheme.terracotta)
                    .offset(y: 19)
            }
        }
    }

    @MainActor private func toggle() async {
        if enabled {
            enabled = false
            endDate = nil
            NotificationManager.shared.cancelRoleSwap(roomId: roomId)
            return
        }
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
            showPermissionHint = true
            return
        }
        endDate = Date().addingTimeInterval(15 * 60)
        enabled = true
        showPermissionHint = false
        await NotificationManager.shared.scheduleRoleSwap(roomId: roomId)
    }
}

private struct LearningPlanView: View {
    let room: LearningRoom

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                pageHeader(room.curriculum.title, subtitle: room.curriculum.description)
                BrandCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Eyebrow(title: "Shared goal")
                        Text(room.curriculum.goal).font(.body).foregroundStyle(SkillSyncTheme.forest)
                    }
                }
                if let paths = room.curriculum.learningPaths {
                    HStack(alignment: .top, spacing: 12) {
                        PersonalPathCard(title: "Learner A", path: paths.userA)
                        PersonalPathCard(title: "Learner B", path: paths.userB)
                    }
                } else {
                    ForEach(Array(room.curriculum.stages.enumerated()), id: \.offset) { index, stage in
                        BrandCard {
                            HStack(alignment: .top, spacing: 12) {
                                Text(String(format: "%02d", index + 1))
                                    .font(.caption.bold().monospaced())
                                    .foregroundStyle(SkillSyncTheme.terracotta)
                                Text(stage).font(.subheadline).foregroundStyle(SkillSyncTheme.forest)
                            }
                        }
                    }
                }
            }
            .padding(14)
        }
        .background(SkillSyncTheme.ivory)
    }
}

private struct PersonalPathCard: View {
    let title: String
    let path: PersonalLearningPath

    var body: some View {
        BrandCard {
            VStack(alignment: .leading, spacing: 10) {
                Eyebrow(title: title)
                Text(path.title).font(.headline).foregroundStyle(SkillSyncTheme.forest)
                Text(path.goal).font(.footnote).foregroundStyle(SkillSyncTheme.muted)
                ForEach(Array(path.stages.enumerated()), id: \.offset) { index, stage in
                    HStack(alignment: .top, spacing: 7) {
                        Text("\(index + 1)").font(.caption.bold()).foregroundStyle(SkillSyncTheme.terracotta)
                        Text(stage).font(.caption).foregroundStyle(SkillSyncTheme.forest)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}
