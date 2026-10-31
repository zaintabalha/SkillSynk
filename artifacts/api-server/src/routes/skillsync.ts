import { getAuth } from "@clerk/express";
import {
  ConnectSkillSyncMatchBody,
  ConnectSkillSyncMatchResponse,
  GenerateSkillSyncDailyChallengeParams,
  GenerateSkillSyncDailyChallengeResponse,
  GenerateSkillSyncRecommendationsResponse,
  GetSkillSyncDashboardResponse,
  GetSkillSyncMatchesResponse,
  GetSkillSyncProfileResponse,
  GetSkillSyncRoomParams,
  GetSkillSyncRoomResponse,
  GetSkillSyncRoomsResponse,
  SaveSkillSyncProfileBody,
  SaveSkillSyncProfileResponse,
  SendSkillSyncMessageBody,
  SendSkillSyncMessageParams,
  SendSkillSyncMessageResponse,
  SubmitSkillSyncProjectBody,
  SubmitSkillSyncProjectParams,
  SubmitSkillSyncProjectResponse,
} from "@workspace/api-zod";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  ne,
  or,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import {
  db,
  skillSyncMatchesTable,
  skillSyncMessagesTable,
  skillSyncProfilesTable,
  skillSyncRoomsTable,
  skillSyncSubmissionsTable,
  type SkillSyncProfile,
  type SkillSyncRoom,
} from "@workspace/db";
import {
  buildChallenge,
  evaluateProjectContent,
  generateCurriculum,
  generateDailyChallengeContent,
  generateMatchRankings,
  isGeminiEnabled,
  moderateChatMessage,
  type CandidateForMatch,
} from "../lib/skillsync-ai";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to use SkillSync." });
    return;
  }
  res.locals.userId = userId;
  next();
};

router.use("/skillsync", requireAuth);

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function profileDto(profile: SkillSyncProfile) {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    university: profile.university,
    teachSkill: profile.teachSkill,
    learnSkill: profile.learnSkill,
    bio: profile.bio,
    createdAt: iso(profile.createdAt),
    updatedAt: iso(profile.updatedAt),
  };
}

async function getProfile(userId: string): Promise<SkillSyncProfile | null> {
  const [profile] = await db
    .select()
    .from(skillSyncProfilesTable)
    .where(eq(skillSyncProfilesTable.userId, userId))
    .limit(1);
  return profile ?? null;
}

async function ensureDemoProfiles(): Promise<void> {
  const [existing] = await db
    .select({ userId: skillSyncProfilesTable.userId })
    .from(skillSyncProfilesTable)
    .where(eq(skillSyncProfilesTable.isDemo, true))
    .limit(1);
  if (existing) return;

  await db
    .insert(skillSyncProfilesTable)
    .values([
      {
        userId: "skillsync-demo-mateo",
        displayName: "Mateo Alvarez",
        university: "UCLA",
        teachSkill: "Spanish",
        learnSkill: "Web development",
        bio: "Linguistics student who loves turning language lessons into small, useful tools.",
        isDemo: true,
      },
      {
        userId: "skillsync-demo-lina",
        displayName: "Lina Haddad",
        university: "American University of Beirut",
        teachSkill: "Arabic",
        learnSkill: "Python programming",
        bio: "Language tutor and beginner programmer building practical learning projects.",
        isDemo: true,
      },
      {
        userId: "skillsync-demo-priya",
        displayName: "Priya Nair",
        university: "University of Toronto",
        teachSkill: "Product design",
        learnSkill: "Frontend development",
        bio: "Design student interested in accessible interfaces and collaborative learning.",
        isDemo: true,
      },
    ])
    .onConflictDoNothing();
}

function skillOverlap(left: string, right: string): number {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
  const a = normalize(left);
  const b = normalize(right);
  if (a === b) return 1;
  const wordsA = new Set(a.split(/\s+/).filter((word) => word.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((word) => word.length > 2));
  if (!wordsA.size || !wordsB.size) return 0;
  const common = [...wordsA].filter((word) => wordsB.has(word)).length;
  return common / Math.max(wordsA.size, wordsB.size);
}

function deterministicRecommendations(
  current: SkillSyncProfile,
  profiles: SkillSyncProfile[],
): CandidateForMatch[] {
  return profiles
    .map((candidate) => {
      const learnFromCandidate = skillOverlap(current.learnSkill, candidate.teachSkill);
      const candidateLearnsFromCurrent = skillOverlap(current.teachSkill, candidate.learnSkill);
      const score = Math.min(
        99,
        Math.round(48 + learnFromCandidate * 31 + candidateLearnsFromCurrent * 20),
      );
      const whyMatch =
        learnFromCandidate > 0 && candidateLearnsFromCurrent > 0
          ? `You can teach ${current.teachSkill} while learning ${candidate.teachSkill}.`
          : learnFromCandidate > 0
            ? `Their ${candidate.teachSkill} connects with what you want to learn.`
            : candidateLearnsFromCurrent > 0
              ? `They want to learn ${candidate.learnSkill}, which you can teach.`
              : `Explore a skill exchange around ${current.teachSkill} and ${candidate.teachSkill}.`;
      return {
        userId: candidate.userId,
        displayName: candidate.displayName,
        university: candidate.university,
        teachSkill: candidate.teachSkill,
        learnSkill: candidate.learnSkill,
        bio: candidate.bio,
        compatibilityScore: score,
        whyMatch,
      };
    })
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, 8);
}

async function getCandidateProfiles(userId: string): Promise<SkillSyncProfile[]> {
  await ensureDemoProfiles();
  return db
    .select()
    .from(skillSyncProfilesTable)
    .where(ne(skillSyncProfilesTable.userId, userId));
}

async function listRoomSummaries(userId: string) {
  const rows = await db
    .select({
      roomId: skillSyncRoomsTable.id,
      matchId: skillSyncMatchesTable.id,
      userAId: skillSyncMatchesTable.userAId,
      userBId: skillSyncMatchesTable.userBId,
      projectTitle: skillSyncRoomsTable.projectTitle,
      status: skillSyncRoomsTable.status,
      progress: skillSyncRoomsTable.progress,
      updatedAt: skillSyncRoomsTable.updatedAt,
    })
    .from(skillSyncRoomsTable)
    .innerJoin(
      skillSyncMatchesTable,
      eq(skillSyncRoomsTable.matchId, skillSyncMatchesTable.id),
    )
    .where(
      or(
        eq(skillSyncMatchesTable.userAId, userId),
        eq(skillSyncMatchesTable.userBId, userId),
      ),
    )
    .orderBy(desc(skillSyncRoomsTable.updatedAt));

  if (!rows.length) return [];
  const partnerIds = [
    ...new Set(rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId))),
  ];
  const [partners, messages] = await Promise.all([
    db
      .select({ userId: skillSyncProfilesTable.userId, displayName: skillSyncProfilesTable.displayName })
      .from(skillSyncProfilesTable)
      .where(inArray(skillSyncProfilesTable.userId, partnerIds)),
    db
      .select({
        roomId: skillSyncMessagesTable.roomId,
        content: skillSyncMessagesTable.content,
      })
      .from(skillSyncMessagesTable)
      .where(inArray(skillSyncMessagesTable.roomId, rows.map((row) => row.roomId)))
      .orderBy(desc(skillSyncMessagesTable.createdAt)),
  ]);
  const partnerNames = new Map(partners.map((partner) => [partner.userId, partner.displayName]));
  const latestMessages = new Map<string, string>();
  for (const message of messages) {
    if (!latestMessages.has(message.roomId)) {
      latestMessages.set(message.roomId, message.content);
    }
  }

  return rows.map((row) => {
    const partnerId = row.userAId === userId ? row.userBId : row.userAId;
    return {
      roomId: row.roomId,
      partnerUserId: partnerId,
      partnerName: partnerNames.get(partnerId) ?? "Learning partner",
      projectTitle: row.projectTitle,
      status: row.status,
      progress: row.progress,
      lastMessage: latestMessages.get(row.roomId) ?? null,
      updatedAt: iso(row.updatedAt),
    };
  });
}

async function getRoomContext(roomId: string, userId: string) {
  const [room] = await db
    .select()
    .from(skillSyncRoomsTable)
    .where(eq(skillSyncRoomsTable.id, roomId))
    .limit(1);
  if (!room) return null;

  const [match] = await db
    .select()
    .from(skillSyncMatchesTable)
    .where(eq(skillSyncMatchesTable.id, room.matchId))
    .limit(1);
  if (!match || (match.userAId !== userId && match.userBId !== userId)) return null;

  const partnerId = match.userAId === userId ? match.userBId : match.userAId;
  const [partner] = await db
    .select()
    .from(skillSyncProfilesTable)
    .where(eq(skillSyncProfilesTable.userId, partnerId))
    .limit(1);
  return { room, match, partner: partner ?? null };
}

function submissionDto(submission: typeof skillSyncSubmissionsTable.$inferSelect) {
  return {
    id: submission.id,
    title: submission.title,
    content: submission.content,
    technicalScore: submission.technicalScore,
    communicationScore: submission.communicationScore,
    overallScore: submission.overallScore,
    technicalFeedback: submission.technicalFeedback,
    communicationFeedback: submission.communicationFeedback,
    nextSteps: submission.nextSteps,
    submittedAt: iso(submission.submittedAt),
    aiPowered: submission.aiPowered,
  };
}

router.get("/skillsync/profile", async (req, res): Promise<void> => {
  const profile = await getProfile(res.locals.userId as string);
  res.json(GetSkillSyncProfileResponse.parse({ profile: profile ? profileDto(profile) : null }));
});

router.put("/skillsync/profile", async (req, res): Promise<void> => {
  const parsed = SaveSkillSyncProfileBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid SkillSync profile");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [profile] = await db
    .insert(skillSyncProfilesTable)
    .values({ userId, ...parsed.data, isDemo: false })
    .onConflictDoUpdate({
      target: skillSyncProfilesTable.userId,
      set: { ...parsed.data, updatedAt: new Date(), isDemo: false },
    })
    .returning();
  res.json(SaveSkillSyncProfileResponse.parse(profileDto(profile)));
});

router.get("/skillsync/matches", async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const current = await getProfile(userId);
  if (!current) {
    res.status(409).json({ error: "Complete your profile to see skill matches." });
    return;
  }
  const profiles = await getCandidateProfiles(userId);
  res.json(
    GetSkillSyncMatchesResponse.parse(deterministicRecommendations(current, profiles)),
  );
});

router.post("/skillsync/matches/recommendations", async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const current = await getProfile(userId);
  if (!current) {
    res.status(409).json({ error: "Complete your profile before generating matches." });
    return;
  }
  const profiles = await getCandidateProfiles(userId);
  const baseline = deterministicRecommendations(current, profiles);
  const rankings = await generateMatchRankings(current, baseline);
  if (!rankings) {
    res.json(
      GenerateSkillSyncRecommendationsResponse.parse({
        recommendations: baseline,
        aiPowered: false,
      }),
    );
    return;
  }

  const candidatesById = new Map(baseline.map((candidate) => [candidate.userId, candidate]));
  const recommendations = rankings
    .map((ranking) => {
      const candidate = candidatesById.get(ranking.userId);
      return candidate
        ? { ...candidate, compatibilityScore: ranking.compatibilityScore, whyMatch: ranking.whyMatch }
        : null;
    })
    .filter((candidate): candidate is CandidateForMatch => candidate !== null);
  res.json(
    GenerateSkillSyncRecommendationsResponse.parse({
      recommendations,
      aiPowered: true,
    }),
  );
});

router.post("/skillsync/matches/connect", async (req, res): Promise<void> => {
  const parsed = ConnectSkillSyncMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  if (parsed.data.partnerUserId === userId) {
    res.status(400).json({ error: "You cannot connect with your own profile." });
    return;
  }
  const [current, partner] = await Promise.all([
    getProfile(userId),
    getProfile(parsed.data.partnerUserId),
  ]);
  if (!current) {
    res.status(409).json({ error: "Complete your profile before starting a room." });
    return;
  }
  if (!partner) {
    res.status(404).json({ error: "That student profile could not be found." });
    return;
  }

  const [existing] = await db
    .select({ roomId: skillSyncRoomsTable.id })
    .from(skillSyncMatchesTable)
    .innerJoin(
      skillSyncRoomsTable,
      eq(skillSyncMatchesTable.id, skillSyncRoomsTable.matchId),
    )
    .where(
      or(
        and(
          eq(skillSyncMatchesTable.userAId, userId),
          eq(skillSyncMatchesTable.userBId, partner.userId),
        ),
        and(
          eq(skillSyncMatchesTable.userAId, partner.userId),
          eq(skillSyncMatchesTable.userBId, userId),
        ),
      ),
    )
    .limit(1);
  if (existing) {
    const summary = (await listRoomSummaries(userId)).find(
      (room) => room.roomId === existing.roomId,
    );
    if (summary) {
      res.status(201).json(ConnectSkillSyncMatchResponse.parse(summary));
      return;
    }
  }

  const curriculum = await generateCurriculum(current, partner);
  const firstChallenge = buildChallenge(
    await generateDailyChallengeContent(curriculum, 1),
    1,
  );
  const matchId = randomUUID();
  const roomId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(skillSyncMatchesTable).values({
      id: matchId,
      userAId: userId,
      userBId: partner.userId,
      rationale: "A complementary campus skill exchange.",
    });
    await tx.insert(skillSyncRoomsTable).values({
      id: roomId,
      matchId,
      projectTitle: curriculum.title,
      status: "active",
      progress: 8,
      curriculum,
      challenge: firstChallenge,
      challengeDay: 1,
    });
    await tx.insert(skillSyncMessagesTable).values({
      id: randomUUID(),
      roomId,
      senderId: null,
      senderName: "SkillSync Moderator",
      senderType: "moderator",
      content: `Welcome to your co-learning room. Start by introducing yourselves and sharing one thing you hope to learn from ${partner.displayName}.`,
    });
  });
  const summary = (await listRoomSummaries(userId)).find((room) => room.roomId === roomId);
  if (!summary) {
    res.status(500).json({ error: "The learning room was created but could not be loaded." });
    return;
  }
  res.status(201).json(ConnectSkillSyncMatchResponse.parse(summary));
});

router.get("/skillsync/rooms", async (req, res): Promise<void> => {
  const summaries = await listRoomSummaries(res.locals.userId as string);
  res.json(GetSkillSyncRoomsResponse.parse(summaries));
});

router.get("/skillsync/rooms/:roomId", async (req, res): Promise<void> => {
  const params = GetSkillSyncRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const context = await getRoomContext(params.data.roomId, res.locals.userId as string);
  if (!context) {
    res.status(404).json({ error: "Learning room not found." });
    return;
  }

  const [messages, submissions] = await Promise.all([
    db
      .select()
      .from(skillSyncMessagesTable)
      .where(eq(skillSyncMessagesTable.roomId, context.room.id))
      .orderBy(skillSyncMessagesTable.createdAt),
    db
      .select()
      .from(skillSyncSubmissionsTable)
      .where(eq(skillSyncSubmissionsTable.roomId, context.room.id))
      .orderBy(desc(skillSyncSubmissionsTable.submittedAt)),
  ]);
  res.json(
    GetSkillSyncRoomResponse.parse({
      roomId: context.room.id,
      partnerUserId: context.partner?.userId ?? "",
      partnerName: context.partner?.displayName ?? "Learning partner",
      projectTitle: context.room.projectTitle,
      status: context.room.status,
      progress: context.room.progress,
      curriculum: context.room.curriculum,
      challenge: context.room.challenge,
      messages: messages.map((message) => ({
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderType: message.senderType,
        content: message.content,
        createdAt: iso(message.createdAt),
      })),
      submissions: submissions.map(submissionDto),
      updatedAt: iso(context.room.updatedAt),
    }),
  );
});

router.post("/skillsync/rooms/:roomId/messages", async (req, res): Promise<void> => {
  const params = SendSkillSyncMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendSkillSyncMessageBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.content.trim()) {
    res.status(400).json({ error: parsed.success ? "Message cannot be blank." : parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const context = await getRoomContext(params.data.roomId, userId);
  if (!context) {
    res.status(404).json({ error: "Learning room not found." });
    return;
  }
  const profile = await getProfile(userId);
  const senderName = profile?.displayName ?? "Student";
  const createdAt = new Date();
  const [saved] = await db
    .insert(skillSyncMessagesTable)
    .values({
      id: randomUUID(),
      roomId: context.room.id,
      senderId: userId,
      senderName,
      senderType: "student",
      content: parsed.data.content.trim(),
    })
    .returning();

  const skillContext = `${profile?.teachSkill ?? "their teaching skill"} and ${context.partner?.teachSkill ?? "their partner's teaching skill"}`;
  const moderatorNote = await moderateChatMessage(saved.content, skillContext);
  let moderatorMessage: {
    id: string;
    roomId: string;
    senderId: string | null;
    senderName: string;
    senderType: "moderator";
    content: string;
    createdAt: string;
  } | null = null;
  if (moderatorNote) {
    const [savedModerator] = await db
      .insert(skillSyncMessagesTable)
      .values({
        id: randomUUID(),
        roomId: context.room.id,
        senderId: null,
        senderName: "SkillSync Moderator",
        senderType: "moderator",
        content: moderatorNote,
      })
      .returning();
    moderatorMessage = {
      id: savedModerator.id,
      roomId: savedModerator.roomId,
      senderId: null,
      senderName: savedModerator.senderName,
      senderType: "moderator",
      content: savedModerator.content,
      createdAt: iso(savedModerator.createdAt),
    };
  }
  await db
    .update(skillSyncRoomsTable)
    .set({
      progress: Math.min(context.room.progress + 1, 95),
      updatedAt: new Date(),
    })
    .where(eq(skillSyncRoomsTable.id, context.room.id));

  res.status(201).json(
    SendSkillSyncMessageResponse.parse({
      message: {
        id: saved.id,
        roomId: saved.roomId,
        senderId: saved.senderId,
        senderName: saved.senderName,
        senderType: saved.senderType,
        content: saved.content,
        createdAt: iso(saved.createdAt),
      },
      moderatorMessage,
      aiPowered: isGeminiEnabled(),
    }),
  );
});

router.post("/skillsync/rooms/:roomId/daily-challenge", async (req, res): Promise<void> => {
  const params = GenerateSkillSyncDailyChallengeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const context = await getRoomContext(params.data.roomId, res.locals.userId as string);
  if (!context) {
    res.status(404).json({ error: "Learning room not found." });
    return;
  }
  const dayNumber = context.room.challengeDay + 1;
  const content = await generateDailyChallengeContent(context.room.curriculum, dayNumber);
  const challenge = buildChallenge(content, dayNumber);
  await db
    .update(skillSyncRoomsTable)
    .set({ challenge, challengeDay: dayNumber, updatedAt: new Date() })
    .where(eq(skillSyncRoomsTable.id, context.room.id));
  res.json(GenerateSkillSyncDailyChallengeResponse.parse(challenge));
});

router.post("/skillsync/rooms/:roomId/submissions", async (req, res): Promise<void> => {
  const params = SubmitSkillSyncProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SubmitSkillSyncProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const context = await getRoomContext(params.data.roomId, res.locals.userId as string);
  if (!context) {
    res.status(404).json({ error: "Learning room not found." });
    return;
  }
  const evaluation = await evaluateProjectContent(
    parsed.data.title,
    parsed.data.content,
    context.room.curriculum,
  );
  const [submission] = await db
    .insert(skillSyncSubmissionsTable)
    .values({
      id: randomUUID(),
      roomId: context.room.id,
      title: parsed.data.title.trim(),
      content: parsed.data.content.trim(),
      ...evaluation,
    })
    .returning();
  await db
    .update(skillSyncRoomsTable)
    .set({ status: "completed", progress: 100, updatedAt: new Date() })
    .where(eq(skillSyncRoomsTable.id, context.room.id));
  res.status(201).json(
    SubmitSkillSyncProjectResponse.parse(submissionDto(submission)),
  );
});

router.get("/skillsync/dashboard", async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [profile, rooms] = await Promise.all([
    getProfile(userId),
    listRoomSummaries(userId),
  ]);
  const recommendations = profile
    ? deterministicRecommendations(profile, await getCandidateProfiles(userId))
    : [];
  const roomIds = rooms.map((room) => room.roomId);
  const submissions = roomIds.length
    ? await db
        .select({ id: skillSyncSubmissionsTable.id })
        .from(skillSyncSubmissionsTable)
        .where(inArray(skillSyncSubmissionsTable.roomId, roomIds))
    : [];
  const recentActivity = rooms.slice(0, 4).map((room) => ({
    id: room.roomId,
    label: room.status === "completed" ? "Project submitted" : "Learning room active",
    detail: `${room.partnerName} · ${room.projectTitle}`,
    createdAt: room.updatedAt,
  }));
  res.json(
    GetSkillSyncDashboardResponse.parse({
      profileComplete: Boolean(profile),
      aiEnabled: isGeminiEnabled(),
      stats: {
        activeRooms: rooms.filter((room) => room.status === "active").length,
        connectionsMade: rooms.length,
        projectsSubmitted: submissions.length,
      },
      recommendations: recommendations.slice(0, 3),
      rooms: rooms.slice(0, 4),
      recentActivity,
    }),
  );
});

export default router;
