import SwiftUI

struct ActivitiesView: View {
    @Binding var room: LearningRoom
    @State private var selectedActivityId: String?
    @State private var kind = "quiz"
    @State private var prompt = ""
    @State private var generating = false
    @State private var error: String?

    private var selectedActivity: SharedActivity? {
        room.activities.first { $0.id == selectedActivityId }
    }

    var body: some View {
        Group {
            if let selectedActivity {
                VStack(spacing: 12) {
                    HStack {
                        Button {
                            selectedActivityId = nil
                            error = nil
                        } label: {
                            Label("All activities", systemImage: "chevron.left")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(SkillSyncTheme.forestLight)
                        Spacer()
                        Text(selectedActivity.kind.uppercased())
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(SkillSyncTheme.terracotta)
                    }
                    .padding(.horizontal, 14)
                    if selectedActivity.kind == "simulator" {
                        SimulatorWorkspace(roomId: room.roomId, activity: selectedActivity)
                    } else {
                        ActivityPracticeView(roomId: room.roomId, activity: selectedActivity, onSubmitted: refreshRoom)
                    }
                }
            } else {
                activityLibrary
            }
        }
        .background(SkillSyncTheme.ivory)
    }

    private var activityLibrary: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                pageHeader("Shared activities", subtitle: "Practice together with quizzes, flashcards, and code simulators.")
                BrandCard {
                    VStack(alignment: .leading, spacing: 13) {
                        Picker("Activity type", selection: $kind) {
                            Text("Quiz").tag("quiz")
                            Text("Flashcards").tag("flashcards")
                            Text("Simulator").tag("simulator")
                        }
                        .pickerStyle(.segmented)
                        TextField("What should the activity cover?", text: $prompt, axis: .vertical)
                            .lineLimit(2...4)
                            .padding(12)
                            .background(SkillSyncTheme.ivory, in: RoundedRectangle(cornerRadius: 12))
                        Button {
                            Task { await createActivity() }
                        } label: {
                            HStack {
                                Spacer()
                                if generating { ProgressView().tint(.white) }
                                else { Label("Create with SkillSync AI", systemImage: "sparkles") }
                                Spacer()
                            }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.vertical, 14)
                            .background(SkillSyncTheme.forestLight, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .disabled(generating || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
                if let error { StatusNotice(text: error, isError: true) }
                sectionHeader("Your shared activities")
                if room.activities.isEmpty {
                    EmptyCard(icon: "square.stack.3d.up", title: "Nothing here yet", detail: "Generate a short activity tailored to what you’re learning.")
                } else {
                    ForEach(room.activities) { activity in
                        Button { selectedActivityId = activity.id } label: {
                            BrandCard {
                                HStack(spacing: 12) {
                                    Image(systemName: iconFor(activity.kind))
                                        .font(.title3)
                                        .foregroundStyle(SkillSyncTheme.terracotta)
                                        .frame(width: 44, height: 44)
                                        .background(SkillSyncTheme.coral.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(activity.title).font(.subheadline.weight(.bold)).foregroundStyle(SkillSyncTheme.forest)
                                        Text(activity.instructions).font(.caption).foregroundStyle(SkillSyncTheme.muted).lineLimit(2)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(SkillSyncTheme.muted)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        }
    }

    @MainActor private func createActivity() async {
        generating = true
        defer { generating = false }
        do {
            let activity: SharedActivity = try await SkillSyncAPI.shared.send(
                "skillsync/rooms/\(room.roomId)/activities",
                method: "POST",
                body: ActivityInput(kind: kind, prompt: prompt.trimmingCharacters(in: .whitespacesAndNewlines))
            )
            room.activities.insert(activity, at: 0)
            prompt = ""
            selectedActivityId = activity.id
            error = nil
        } catch let caughtError { error = caughtError.localizedDescription }
    }

    @MainActor private func refreshRoom() async {
        do {
            room = try await SkillSyncAPI.shared.get("skillsync/rooms/\(room.roomId)")
            error = nil
        } catch let caughtError { error = caughtError.localizedDescription }
    }

    private func iconFor(_ kind: String) -> String {
        switch kind {
        case "quiz": "checklist"
        case "flashcards": "rectangle.stack"
        default: "chevron.left.forwardslash.chevron.right"
        }
    }
}

private struct ActivityPracticeView: View {
    let roomId: String
    let activity: SharedActivity
    let onSubmitted: () async -> Void
    @State private var answers: [Int: String] = [:]
    @State private var submittedAttempt: ActivityAttempt?
    @State private var submitting = false
    @State private var error: String?
    @State private var flippedCards: Set<Int> = []

    private var questions: [[String: JSONValue]] {
        activity.content.objectValue?["questions"]?.arrayValue?.compactMap(\.objectValue) ?? []
    }

    private var flashcards: [[String: JSONValue]] {
        activity.content.objectValue?["flashcards"]?.arrayValue?.compactMap(\.objectValue) ?? []
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                pageHeader(activity.title, subtitle: activity.instructions)
                if activity.kind == "flashcards" {
                    ForEach(Array(flashcards.enumerated()), id: \.offset) { index, card in
                        let isFlipped = flippedCards.contains(index)
                        Button {
                            if isFlipped { flippedCards.remove(index) } else { flippedCards.insert(index) }
                        } label: {
                            BrandCard {
                                VStack(alignment: .leading, spacing: 9) {
                                    Eyebrow(title: isFlipped ? "Answer" : "Prompt · tap to flip")
                                    Text(
                                        card[isFlipped ? "back" : "front"]?.stringValue
                                        ?? card[isFlipped ? "answer" : "question"]?.stringValue
                                        ?? "Card \(index + 1)"
                                    )
                                    .font(.headline)
                                    .foregroundStyle(SkillSyncTheme.forest)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } else if questions.isEmpty {
                    EmptyCard(icon: "doc.text", title: "Activity content unavailable", detail: "Refresh the learning room and try opening this activity again.")
                } else {
                    ForEach(Array(questions.enumerated()), id: \.offset) { index, question in
                        BrandCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Eyebrow(title: "Question \(index + 1)")
                                Text(question["prompt"]?.stringValue ?? question["question"]?.stringValue ?? "Choose the best answer.")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(SkillSyncTheme.forest)
                                let choices = question["options"]?.arrayValue ?? question["choices"]?.arrayValue ?? []
                                ForEach(Array(choices.enumerated()), id: \.offset) { optionIndex, choice in
                                    let text = choice.stringValue ?? choice.objectValue?["text"]?.stringValue ?? "Option \(optionIndex + 1)"
                                    Button {
                                        answers[index] = text
                                    } label: {
                                        HStack {
                                            Image(systemName: answers[index] == text ? "largecircle.fill.circle" : "circle")
                                            Text(text)
                                            Spacer()
                                        }
                                        .font(.footnote)
                                        .foregroundStyle(SkillSyncTheme.forest)
                                        .padding(10)
                                        .background(answers[index] == text ? SkillSyncTheme.forestLight.opacity(0.10) : SkillSyncTheme.ivory, in: RoundedRectangle(cornerRadius: 11))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            Spacer()
                            if submitting { ProgressView().tint(.white) }
                            else { Text("Submit answers") }
                            Spacer()
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.vertical, 14)
                        .background(SkillSyncTheme.forestLight, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(submitting || answers.count != questions.count)
                }
                if let submittedAttempt {
                    StatusNotice(text: submittedAttempt.score.map { "Your result: \($0)%." } ?? "Your answers were saved.")
                }
                if let error { StatusNotice(text: error, isError: true) }
            }
            .padding(14)
            .frame(maxWidth: 850)
            .frame(maxWidth: .infinity)
        }
    }

    @MainActor private func submit() async {
        submitting = true
        defer { submitting = false }
        do {
            let response: ActivityAttempt = try await SkillSyncAPI.shared.send(
                "skillsync/rooms/\(roomId)/activities/\(activity.id)/attempts",
                method: "POST",
                body: ActivityAttemptInput(responses: questions.indices.map { answers[$0] ?? "" })
            )
            submittedAttempt = response
            error = nil
            await onSubmitted()
        } catch let caughtError { error = caughtError.localizedDescription }
    }
}
