import { db, skillSyncProfilesTable as profiles, skillSyncMatchesTable as matches, skillSyncRoomsTable as rooms, skillSyncMessagesTable as messages, skillSyncReportsTable as reports, skillSyncSubmissionsTable as submissions } from "@workspace/db";

let seed: Promise<void> | undefined;
export function ensureDemoData(): Promise<void> {
  seed ??= seedData().catch((error) => { seed = undefined; throw error; });
  return seed;
}
async function seedData() {
  await db.transaction(async (tx) => {
    await tx.insert(profiles).values([
      { userId: "skillsync-demo-lina", displayName: "Lina Haddad", university: "American University of Beirut", teachSkill: "Arabic", learnSkill: "Python programming", bio: "Sample language tutor learning to build useful tools.", isDemo: true },
      { userId: "skillsync-demo-mateo", displayName: "Mateo Alvarez", university: "UCLA", teachSkill: "Python programming", learnSkill: "Arabic", bio: "Sample programmer practicing clear bilingual communication.", isDemo: true },
      { userId: "skillsync-demo-priya", displayName: "Priya Nair", university: "University of Toronto", teachSkill: "Product design", learnSkill: "Frontend development", bio: "Sample designer building accessible student tools.", isDemo: true },
    ]).onConflictDoNothing();
    await tx.insert(matches).values([
      { id: "skillsync-demo-match-1", userAId: "skillsync-demo-lina", userBId: "skillsync-demo-mateo", rationale: "Demo reciprocal language/programming exchange." },
      { id: "skillsync-demo-match-2", userAId: "skillsync-demo-priya", userBId: "skillsync-demo-mateo", rationale: "Demo design and development exchange." },
    ]).onConflictDoNothing();
    const curriculum = {
      title: "Build a bilingual study companion",
      description: "Combine language teaching and programming in a small study tool.",
      goal: "Create three bilingual flashcards and explain how the tool stores them.",
      stages: ["Agree on three vocabulary items", "Design a clear flashcard interaction", "Build and test the first version", "Explain the result and exchange feedback"],
    };
    await tx.insert(rooms).values([
      { id: "skillsync-demo-room-1", matchId: "skillsync-demo-match-1", projectTitle: curriculum.title, status: "active", progress: 35, isDemo: true, curriculum },
      { id: "skillsync-demo-room-2", matchId: "skillsync-demo-match-2", projectTitle: "Accessible campus guide", status: "completed", progress: 100, isDemo: true, curriculum: { ...curriculum, title: "Accessible campus guide", goal: "Build and explain an accessible guide prototype." } },
    ]).onConflictDoNothing();
    await tx.insert(messages).values([
      { id: "skillsync-demo-msg-1", roomId: "skillsync-demo-room-1", senderId: "skillsync-demo-lina", senderName: "Lina Haddad", senderType: "student", channel: "partner", content: "Let's build three bilingual flashcards first. How should we store each question and answer?" },
      { id: "skillsync-demo-msg-2", roomId: "skillsync-demo-room-1", senderId: "skillsync-demo-mateo", senderName: "Mateo Alvarez", senderType: "student", channel: "partner", content: "We can use a list of objects with front and back fields, then test one card at a time." },
    ]).onConflictDoNothing();
    await tx.insert(submissions).values({
      id: "skillsync-demo-submission", roomId: "skillsync-demo-room-2", title: "Campus guide prototype", content: "Sample submission: a keyboard-accessible guide with bilingual navigation and a shared design explanation.",
      technicalScore: 85, communicationScore: 88, overallScore: 87, technicalFeedback: "Sample feedback: check focus visibility on every control.", communicationFeedback: "Sample feedback: include a short explanation of each partner's contribution.", nextSteps: ["Test with a keyboard", "Document one improvement"], aiPowered: false,
    }).onConflictDoNothing();
    await tx.insert(reports).values([
      { id: "skillsync-demo-report-1", reporterUserId: "skillsync-demo-lina", reportedUserId: "skillsync-demo-mateo", roomId: "skillsync-demo-room-1", category: "inactive_partner", summary: "Missed two planned sessions", details: "Sample complaint: the pair needs help agreeing on a schedule.", status: "pending", isDemo: true },
      { id: "skillsync-demo-report-2", reporterUserId: "skillsync-demo-priya", roomId: "skillsync-demo-room-2", category: "technical_issue", summary: "Small-screen layout issue", details: "Sample complaint: a tablet user could not read an entire project preview.", status: "under_review", isDemo: true },
      { id: "skillsync-demo-report-3", reporterUserId: "skillsync-demo-mateo", reportedUserId: "skillsync-demo-lina", roomId: "skillsync-demo-room-1", category: "inappropriate_behavior", summary: "Feedback tone concern", details: "Sample complaint: a message sounded dismissive; the partners clarified their intent.", status: "resolved", adminNotes: "Sample resolution: both partners agreed on respectful feedback.", isDemo: true },
      { id: "skillsync-demo-report-4", reporterUserId: "skillsync-demo-priya", category: "other", summary: "Help choosing a project scope", details: "Sample complaint: the pair would like guidance on reducing the project scope.", status: "pending", isDemo: true },
    ]).onConflictDoNothing();
  });
}
