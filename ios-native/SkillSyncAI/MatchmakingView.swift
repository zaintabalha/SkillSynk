import SwiftUI

struct MatchmakingView: View {
    let openRoom: (RoomSummary) -> Void
    @State private var recommendations: [MatchCandidate] = []
    @State private var loading = true
    @State private var error: String?
    @State private var connectingId: String?
    @State private var notice: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    pageHeader("The right kind of different.", subtitle: "Find learners whose strengths complement what you want to learn.")
                    BrandCard {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .foregroundStyle(SkillSyncTheme.terracotta)
                                .font(.title3)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Learning goes both ways").font(.headline).foregroundStyle(SkillSyncTheme.forest)
                                Text("Recommendations pair what you can teach with what someone else wants to learn.")
                                    .font(.footnote).foregroundStyle(SkillSyncTheme.muted)
                            }
                        }
                    }
                    if let notice { StatusNotice(text: notice) }
                    if let error { StatusNotice(text: error, isError: true) }
                    if loading && recommendations.isEmpty {
                        ProgressView().frame(maxWidth: .infinity).padding(44)
                    } else if recommendations.isEmpty {
                        EmptyCard(icon: "sparkles", title: "Your profile is active", detail: "There are no new unmatched partners available right now. Your profile is in the discovery pool; check back later or open an existing learning room.")
                    } else {
                        ForEach(recommendations) { candidate in
                            MatchCard(candidate: candidate, isConnecting: connectingId == candidate.id) {
                                Task { await connect(candidate) }
                            }
                        }
                    }
                    Button {
                        Task { await load() }
                    } label: {
                        Label("Find fresh matches", systemImage: "arrow.clockwise")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(SkillSyncTheme.forest.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(SkillSyncTheme.forest)
                }
                .padding(20)
                .frame(maxWidth: 900)
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
            let result: RecommendationResponse = try await SkillSyncAPI.shared.get("skillsync/matches")
            recommendations = result.recommendations
            error = nil
        } catch let caughtError { error = caughtError.localizedDescription }
        loading = false
    }

    @MainActor private func connect(_ candidate: MatchCandidate) async {
        connectingId = candidate.id
        defer { connectingId = nil }
        do {
            let room: RoomSummary = try await SkillSyncAPI.shared.send(
                "skillsync/matches/connect",
                method: "POST",
                body: ConnectInput(partnerUserId: candidate.userId)
            )
            recommendations.removeAll { $0.id == candidate.id }
            notice = "You’re connected with \(candidate.displayName). Your learning room is ready."
            openRoom(room)
        } catch let caughtError { error = caughtError.localizedDescription }
    }
}

private struct MatchCard: View {
    let candidate: MatchCandidate
    let isConnecting: Bool
    let connect: () -> Void

    var body: some View {
        BrandCard {
            VStack(alignment: .leading, spacing: 13) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(candidate.displayName).font(.title3.weight(.bold)).foregroundStyle(SkillSyncTheme.forest)
                        Text(candidate.university).font(.footnote).foregroundStyle(SkillSyncTheme.muted)
                    }
                    Spacer()
                    Text("\(candidate.compatibilityScore)%")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(SkillSyncTheme.forestLight)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 7)
                        .background(SkillSyncTheme.forestLight.opacity(0.10), in: Capsule())
                }
                HStack(spacing: 8) {
                    skillChip("Can teach", candidate.teachSkill, tint: SkillSyncTheme.forestLight)
                    skillChip("Wants to learn", candidate.learnSkill, tint: SkillSyncTheme.terracotta)
                }
                Text(candidate.whyMatch).font(.footnote).foregroundStyle(SkillSyncTheme.muted)
                if !candidate.bio.isEmpty { Text(candidate.bio).font(.footnote).foregroundStyle(SkillSyncTheme.forest) }
                Button(action: connect) {
                    HStack {
                        Spacer()
                        if isConnecting { ProgressView().tint(.white) }
                        else { Label("Connect and open room", systemImage: "arrow.up.right") }
                        Spacer()
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.vertical, 13)
                    .background(SkillSyncTheme.forestLight, in: RoundedRectangle(cornerRadius: 14))
                }
                .disabled(isConnecting)
            }
        }
    }

    private func skillChip(_ label: String, _ skill: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(.system(size: 9, weight: .bold, design: .monospaced)).foregroundStyle(tint)
            Text(skill).font(.caption.weight(.semibold)).foregroundStyle(SkillSyncTheme.forest)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(tint.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
    }
}
