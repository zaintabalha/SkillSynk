import SwiftUI
import ClerkKit

struct ProfileView: View {
    @Environment(Clerk.self) private var clerk
    @State private var profile: SkillProfile?
    @State private var displayName = ""
    @State private var university = ""
    @State private var teachSkill = ""
    @State private var learnSkill = ""
    @State private var bio = ""
    @State private var error: String?
    @State private var saved = false
    @State private var loading = true
    @State private var saving = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    pageHeader("Your learning profile", subtitle: "Tell potential partners what you can share and what you want to learn.")
                    BrandCard {
                        VStack(alignment: .leading, spacing: 15) {
                            formField("Name", text: $displayName, prompt: "Your name")
                            formField("University", text: $university, prompt: "School or campus")
                            formField("A skill I can teach", text: $teachSkill, prompt: "e.g. Python, Arabic, design")
                            formField("A skill I want to learn", text: $learnSkill, prompt: "e.g. statistics, English")
                            VStack(alignment: .leading, spacing: 6) {
                                Text("ABOUT YOU").font(.system(size: 10, weight: .bold, design: .monospaced)).tracking(1).foregroundStyle(SkillSyncTheme.muted)
                                TextField("A short introduction", text: $bio, axis: .vertical)
                                    .lineLimit(3...6)
                                    .padding(12)
                                    .background(SkillSyncTheme.ivory, in: RoundedRectangle(cornerRadius: 12))
                            }
                            Button {
                                Task { await save() }
                            } label: {
                                HStack {
                                    Spacer()
                                    if saving { ProgressView().tint(.white) }
                                    else { Text(profile == nil ? "Create my profile" : "Save changes") }
                                    Spacer()
                                }
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(.vertical, 14)
                                .background(SkillSyncTheme.forestLight, in: RoundedRectangle(cornerRadius: 14))
                            }
                            .disabled(saving || loading)
                        }
                    }
                    if saved { StatusNotice(text: "Your profile has been saved and can be used for partner discovery.") }
                    if let error { StatusNotice(text: error, isError: true) }
                    Button(role: .destructive) {
                        Task { await signOut() }
                    } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                            .font(.footnote.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(12)
                    }
                    .disabled(saving)
                }
                .padding(20)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .background(SkillSyncTheme.ivory)
            .toolbar(.hidden, for: .navigationBar)
            .task { await load() }
        }
    }

    @MainActor private func load() async {
        do {
            let envelope: ProfileEnvelope = try await SkillSyncAPI.shared.get("skillsync/profile")
            profile = envelope.profile
            if let profile {
                displayName = profile.displayName
                university = profile.university
                teachSkill = profile.teachSkill
                learnSkill = profile.learnSkill
                bio = profile.bio
            }
            error = nil
        } catch { error = error.localizedDescription }
        loading = false
    }

    @MainActor private func save() async {
        guard !displayName.trimmingCharacters(in: .whitespaces).isEmpty,
              !university.trimmingCharacters(in: .whitespaces).isEmpty,
              !teachSkill.trimmingCharacters(in: .whitespaces).isEmpty,
              !learnSkill.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Complete your name, university, teaching skill, and learning goal."
            return
        }
        saving = true
        defer { saving = false }
        do {
            let updated: SkillProfile = try await SkillSyncAPI.shared.send(
                "skillsync/profile",
                method: "PUT",
                body: ProfileInput(
                    displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                    university: university.trimmingCharacters(in: .whitespacesAndNewlines),
                    teachSkill: teachSkill.trimmingCharacters(in: .whitespacesAndNewlines),
                    learnSkill: learnSkill.trimmingCharacters(in: .whitespacesAndNewlines),
                    bio: bio.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
            profile = updated
            saved = true
            error = nil
        } catch { error = error.localizedDescription }
    }

    @MainActor private func signOut() async {
        guard await NotificationManager.shared.removeCurrentDevice() else {
            error = "Could not disconnect push notifications. Check your connection and try signing out again."
            return
        }
        do {
            try await clerk.auth.signOut(sessionId: clerk.session?.id)
        } catch { error = error.localizedDescription }
    }

    private func formField(_ title: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased()).font(.system(size: 10, weight: .bold, design: .monospaced)).tracking(1).foregroundStyle(SkillSyncTheme.muted)
            TextField(prompt, text: text)
                .textInputAutocapitalization(.sentences)
                .padding(12)
                .background(SkillSyncTheme.ivory, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
