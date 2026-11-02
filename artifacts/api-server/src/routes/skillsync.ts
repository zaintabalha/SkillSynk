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
import { Router, type IRouter } from "express";
import {
  db,
  skillSyncMatchesTable,
  skillSyncMessagesTable,
  skillSyncProfilesTable,
  skillSyncRoomsTable,
  skillSyncSubmissionsTable,
  skillSyncSuspensionsTable,
  type SkillSyncProfile,
  type SkillSyncRoom,
} from "@workspace/db";
import {
  buildChallenge,
  buildFallbackCurriculum,
  evaluateProjectContent,
  fallbackProjectEvaluation,
  generateCurriculum,
  generateDailyChallengeContent,
  generateMatchRankings,
  isGeminiEnabled,
  type CandidateForMatch,
} from "../lib/skillsync-ai";
import { requireSkillSyncAuth } from "../lib/skillsync-access";
import { aiRequestContext } from "../lib/skillsync-ai-limits";
import { ensureDemoData } from "../lib/skillsync-demo";
import roomInteractionRouter from "./skillsync-room-interactions";
import adminRouter from "./skillsync-admin";
import { messageDto, roomActivities, recordAiUse, roomContext as sharedRoomContext, roomMemory } from "../lib/skillsync-room-service";

const router: IRouter = Router();

router.use("/skillsync", requireSkillSyncAuth);
router.use("/skillsync", aiRequestContext);
router.use(roomInteractionRouter);
router.use(adminRouter);

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

const SKILL_CONCEPTS: Array<{ key: string; terms: string[] }> = [
  { key: "programming", terms: ["programming", "coding", "software development", "python", "javascript", "برمجة", "برمجه", "تطوير البرمجيات", "تطوير البرامج", "كود", "تكويد"] },
  { key: "web-development", terms: ["web development", "website", "frontend", "front end", "backend", "back end", "تطوير الويب", "تطوير مواقع", "مواقع ويب", "برمجة المواقع"] },
  { key: "english", terms: ["english", "انجليزي", "الانجليزية", "الإنجليزية"] },
  { key: "arabic", terms: ["arabic", "عربي", "العربية"] },
  { key: "design", terms: ["design", "ui ux", "user interface", "تصميم", "واجهات المستخدم", "تجربة المستخدم"] },
  { key: "artificial-intelligence", terms: ["artificial intelligence", "machine learning", "data science", "ذكاء اصطناعي", "تعلم آلي", "علوم البيانات"] },
  { key: "writing", terms: ["writing", "content writing", "copywriting", "كتابة", "كتابة المحتوى", "تحرير"] },
  { key: "math", terms: ["mathematics", "math", "statistics", "رياضيات", "إحصاء", "احصاء"] },
  { key: "communication", terms: ["communication", "public speaking", "presentation", "تواصل", "تحدث أمام الجمهور", "إلقاء"] },
];

const SKILL_STOP_WORDS = new Set([
  "a", "an", "and", "the", "to", "of", "in", "with", "for", "basics", "beginner",
  "learn", "learning", "skill", "skills", "و", "في", "من", "مع", "على", "تعلم",
  "مهارة", "مهارات", "اساسيات", "مبتدئ", "مبتدئة",
]);

function normalizeSkill(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/gu, "")
    .toLocaleLowerCase()
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function skillConcepts(normalized: string): Set<string> {
  const padded = ` ${normalized} `;
  return new Set(
    SKILL_CONCEPTS
      .filter(({ terms }) => terms.some((term) => {
        const normalizedTerm = normalizeSkill(term);
        return normalizedTerm.length > 0 && padded.includes(` ${normalizedTerm} `);
      }))
      .map(({ key }) => key),
  );
}

function tokenSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const used = new Set<string>();
  let matched = 0;
  for (const left of a) {
    const right = [...b].find((candidate) =>
      !used.has(candidate) &&
      (candidate === left ||
        (Math.min(candidate.length, left.length) >= 4 &&
          (candidate.startsWith(left) || left.startsWith(candidate)))),
    );
    if (right) {
      used.add(right);
      matched += 1;
    }
  }
  return matched / Math.max(a.size, b.size);
}

function characterSimilarity(a: string, b: string): number {
  const grams = (value: string) => {
    const chars = Array.from(value.replace(/\s+/gu, ""));
    if (chars.length < 3) return new Set<string>();
    return new Set(chars.slice(0, -2).map((_, index) => chars.slice(index, index + 3).join("")));
  };
  const gramsA = grams(a);
  const gramsB = grams(b);
  if (!gramsA.size || !gramsB.size) return 0;
  const common = [...gramsA].filter((gram) => gramsB.has(gram)).length;
  return (2 * common) / (gramsA.size + gramsB.size);
}

function skillOverlap(left: string, right: string): number {
  const a = normalizeSkill(left);
  const b = normalizeSkill(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const words = (value: string) =>
    new Set(value.split(/\s+/u).filter((word) => word.length > 1 && !SKILL_STOP_WORDS.has(word)));
  const lexicalScore = tokenSimilarity(words(a), words(b));
  const conceptScore = tokenSimilarity(skillConcepts(a), skillConcepts(b));
  const fuzzyScore = characterSimilarity(a, b) * 0.75;
  return Math.min(1, Math.max(lexicalScore, conceptScore, fuzzyScore));
}

function deterministicRecommendations(
  current: SkillSyncProfile,
  profiles: SkillSyncProfile[],
  locale = "en",
  options: { includeNoOverlap?: boolean; limit?: number } = {},
): CandidateForMatch[] {
  return profiles
    .map((candidate) => {
      const learnFromCandidate = skillOverlap(current.learnSkill, candidate.teachSkill);
      const candidateLearnsFromCurrent = skillOverlap(current.teachSkill, candidate.learnSkill);
      if (!options.includeNoOverlap && learnFromCandidate === 0 && candidateLearnsFromCurrent === 0) return null;
      const reciprocalFit = learnFromCandidate > 0 && candidateLearnsFromCurrent > 0;
      const score = learnFromCandidate === 0 && candidateLearnsFromCurrent === 0
        ? 35
        : Math.min(
            99,
            Math.round(
              50 +
                learnFromCandidate * 28 +
                candidateLearnsFromCurrent * 21 +
                (reciprocalFit ? 8 : 0),
            ),
          );
      const whyMatch = locale === "ar"
        ? learnFromCandidate === 0 && candidateLearnsFromCurrent === 0
          ? "قد يقدّم هذا الملف توافقاً تكميلياً؛ قيّم المهارات والهدفين معاً."
          : learnFromCandidate > 0 && candidateLearnsFromCurrent > 0
          ? `يمكنك تعليم ${current.teachSkill} وتعلّم ${candidate.teachSkill} من هذا الشريك.`
          : learnFromCandidate > 0
            ? `تتوافق مهارة ${candidate.teachSkill} مع هدفك في التعلّم.`
            : `يمكنك تعليم ${current.teachSkill} لهذا الشريك.`
        : learnFromCandidate > 0 && candidateLearnsFromCurrent > 0
          ? `You can teach ${current.teachSkill} while learning ${candidate.teachSkill}.`
          : learnFromCandidate > 0
            ? `Their ${candidate.teachSkill} connects with what you want to learn.`
            : candidateLearnsFromCurrent > 0
              ? `They want to learn ${candidate.learnSkill}, which you can teach.`
              : "Potential complementary exchange; assess both goals and skill areas.";
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
    .filter((candidate): candidate is CandidateForMatch => candidate !== null)
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, options.limit ?? 8);
}

async function getCandidateProfiles(userId: string): Promise<SkillSyncProfile[]> {
  await ensureDemoProfiles();
  const [restricted, existingPairs, candidates] = await Promise.all([
    db.select().from(skillSyncSuspensionsTable),
    db
      .select({
        userAId: skillSyncMatchesTable.userAId,
        userBId: skillSyncMatchesTable.userBId,
      })
      .from(skillSyncMatchesTable)
      .where(
        or(
          eq(skillSyncMatchesTable.userAId, userId),
          eq(skillSyncMatchesTable.userBId, userId),
        ),
      ),
    db
      .select()
      .from(skillSyncProfilesTable)
      .where(ne(skillSyncProfilesTable.userId, userId))
      .orderBy(desc(skillSyncProfilesTable.updatedAt)),
  ]);
  const now = new Date();
  const blocked = new Set(
    restricted.filter((s) => !s.endsAt || s.endsAt > now).map((s) => s.userId),
  );
  const alreadyPaired = new Set(
    existingPairs.map((pair) => pair.userAId === userId ? pair.userBId : pair.userAId),
  );
  return candidates.filter((profile) =>
    !blocked.has(profile.userId) &&
    !alreadyPaired.has(profile.userId) &&
    typeof profile.teachSkill === "string" && profile.teachSkill.trim().length > 0 &&
    typeof profile.learnSkill === "string" && profile.learnSkill.trim().length > 0,
  );
}

async function listRoomSummaries(userId: string) {
  await ensureDemoData();
  const rows = await db
    .select({
      roomId: skillSyncRoomsTable.id,
      matchId: skillSyncMatchesTable.id,
      userAId: skillSyncMatchesTable.userAId,
      userBId: skillSyncMatchesTable.userBId,
      projectTitle: skillSyncRoomsTable.projectTitle,
      status: skillSyncRoomsTable.status,
      progress: skillSyncRoomsTable.progress,
      isDemo: skillSyncRoomsTable.isDemo,
      updatedAt: skillSyncRoomsTable.updatedAt,
    })
    .from(skillSyncRoomsTable)
    .innerJoin(
      skillSyncMatchesTable,
      eq(skillSyncRoomsTable.matchId, skillSyncMatchesTable.id),
    )
    .where(
      or(
        eq(skillSyncRoomsTable.isDemo, true),
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
      isDemo: row.isDemo === true,
      lastMessage: latestMessages.get(row.roomId) ?? null,
      updatedAt: iso(row.updatedAt),
    };
  });
}

async function getRoomContext(roomId: string, userId: string) {
  await ensureDemoData();
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
  if (!match || (!room.isDemo && match.userAId !== userId && match.userBId !== userId)) return null;

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
    evaluationStatus: submission.evaluationStatus as "pending" | "ready" | "fallback",
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
  const locale = req.get("accept-language")?.toLowerCase().startsWith("ar") ? "ar" : "en";
  const current = await getProfile(userId);
  if (!current) {
    res.status(409).json({
      error: locale === "ar"
        ? "أكمل ملفك الشخصي لعرض تطابقات المهارات."
        : "Complete your profile to see skill matches.",
    });
    return;
  }
  const profiles = await getCandidateProfiles(userId);
  res.json(
    GetSkillSyncMatchesResponse.parse(deterministicRecommendations(current, profiles, locale)),
  );
});

router.post("/skillsync/matches/recommendations", async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const locale = req.get("accept-language")?.toLowerCase().startsWith("ar") ? "ar" : "en";
  const current = await getProfile(userId);
  if (!current) {
    res.status(409).json({
      error: locale === "ar"
        ? "أكمل ملفك الشخصي قبل إنشاء توصيات المطابقة."
        : "Complete your profile before generating matches.",
    });
    return;
  }
  const profiles = await getCandidateProfiles(userId);
  const baseline = deterministicRecommendations(current, profiles, locale);
  const candidatePool = deterministicRecommendations(current, profiles, locale, {
    includeNoOverlap: true,
    limit: 24,
  });
  if (!candidatePool.length) {
    res.json(
      GenerateSkillSyncRecommendationsResponse.parse({
        recommendations: [],
        aiPowered: false,
      }),
    );
    return;
  }
  let rankings: Awaited<ReturnType<typeof generateMatchRankings>> = null;
  let rankingFailed = false;
  let rankingTimedOut = false;
  let rankingTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    rankings = await Promise.race([
      generateMatchRankings(current, candidatePool, locale),
      new Promise<null>((resolve) => {
        rankingTimer = setTimeout(() => {
          rankingTimedOut = true;
          resolve(null);
        }, 18_000);
      }),
    ]);
    if (rankingTimedOut) {
      rankingFailed = true;
      req.log.warn({ userId, timeoutMs: 18_000 }, "AI match ranking exceeded its response budget; returning deterministic matches");
    }
  } catch (error) {
    rankingFailed = true;
    req.log.warn({ err: error, userId }, "AI match ranking failed; returning reciprocal skill matches");
  } finally {
    if (rankingTimer) clearTimeout(rankingTimer);
  }
  if (!rankingFailed) {
    try {
      await recordAiUse(userId, "matching", Boolean(rankings?.length));
    } catch (error) {
      req.log.warn({ err: error, userId }, "Could not record AI match-ranking usage");
    }
  }
  if (!rankings?.length) {
    res.json(
      GenerateSkillSyncRecommendationsResponse.parse({
        recommendations: baseline,
        aiPowered: false,
      }),
    );
    return;
  }

  const candidatesById = new Map(candidatePool.map((candidate) => [candidate.userId, candidate]));
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
  const locale = req.get("accept-language")?.toLowerCase().startsWith("ar") ? "ar" : "en";
  if (parsed.data.partnerUserId === userId) {
    res.status(400).json({ error: "You cannot connect with your own profile." });
    return;
  }
  const [current, partner] = await Promise.all([
    getProfile(userId),
    getProfile(parsed.data.partnerUserId),
  ]);
  if (!current) {
    res.status(409).json({
      error: locale === "ar"
        ? "أكمل ملفك الشخصي قبل بدء غرفة تعلّم."
        : "Complete your profile before starting a room.",
    });
    return;
  }
  if (!partner) {
    res.status(404).json({
      error: locale === "ar"
        ? "تعذر العثور على ملف الطالب المطلوب."
        : "That student profile could not be found.",
    });
    return;
  }
  const [restriction] = await db.select().from(skillSyncSuspensionsTable).where(eq(skillSyncSuspensionsTable.userId, partner.userId));
  if (restriction && (!restriction.endsAt || restriction.endsAt > new Date())) {
    res.status(409).json({ error: "This student is not available for matching." }); return;
  }

  const [existingMatch] = await db
    .select({ matchId: skillSyncMatchesTable.id })
    .from(skillSyncMatchesTable)
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
  if (existingMatch) {
    const [existingRoom] = await db
      .select({ roomId: skillSyncRoomsTable.id })
      .from(skillSyncRoomsTable)
      .where(eq(skillSyncRoomsTable.matchId, existingMatch.matchId))
      .limit(1);
    if (!existingRoom) {
      res.status(409).json({ error: "This pair already has a connection, but its room is unavailable." });
      return;
    }
    const summary = (await listRoomSummaries(userId)).find(
      (room) => room.roomId === existingRoom.roomId,
    );
    if (summary) {
      if (summary.status === "unmatched") { res.status(409).json({ error: "This pair was unmatched by an administrator." }); return; }
      res.status(201).json(ConnectSkillSyncMatchResponse.parse(summary));
      return;
    }
    res.status(409).json({ error: "This pair is already connected." });
    return;
  }

  const fallbackCurriculum = buildFallbackCurriculum(current, partner, locale);
  const pendingCurriculum = {
    ...fallbackCurriculum,
    aiPowered: false,
    generationStatus: "pending" as const,
  };
  const firstChallenge = buildChallenge({
    prompt: `Each partner teaches one ${current.teachSkill} or ${partner.teachSkill} technique, then applies it to a personal learning goal.`,
    hint: "Take turns: explain one small idea, try it together, and describe what changed.",
    aiPowered: false,
  }, 1);
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
      projectTitle: fallbackCurriculum.title,
      status: "active",
      progress: 8,
      curriculum: pendingCurriculum,
      challenge: firstChallenge,
      challengeDay: 1,
    });
    await tx.insert(skillSyncMessagesTable).values({
      id: randomUUID(),
      roomId,
      senderId: null,
      senderName: "SkillSync AI",
      senderType: "assistant",
      channel: "ai",
      content: "Your learning room is ready. Personalized paths for both partners are being prepared.",
    });
  });
  void (async () => {
    try {
      const curriculum = await generateCurriculum(current, partner, undefined, locale);
      await db
        .update(skillSyncRoomsTable)
        .set({
          curriculum: { ...curriculum, generationStatus: "ready" },
          projectTitle: curriculum.title,
          updatedAt: new Date(),
        })
        .where(eq(skillSyncRoomsTable.id, roomId));
      try {
        await recordAiUse(userId, "curriculum", curriculum.aiPowered);
      } catch (error) {
        req.log.warn({ err: error, roomId }, "Could not record curriculum-generation usage");
      }

      try {
        const generatedChallenge = await generateDailyChallengeContent(
          curriculum,
          1,
          { students: [current, partner], curriculum, conversation: [] },
          locale,
        );
        await db
          .update(skillSyncRoomsTable)
          .set({ challenge: buildChallenge(generatedChallenge, 1), updatedAt: new Date() })
          .where(eq(skillSyncRoomsTable.id, roomId));
        try {
          await recordAiUse(userId, "challenge", generatedChallenge.aiPowered);
        } catch (error) {
          req.log.warn({ err: error, roomId }, "Could not record challenge-generation usage");
        }
      } catch (error) {
        req.log.warn({ err: error, roomId }, "Could not generate the initial room challenge");
      }
    } catch (error) {
      req.log.warn({ err: error, roomId }, "Background learning-room enrichment failed");
      await db
        .update(skillSyncRoomsTable)
        .set({
          curriculum: { ...pendingCurriculum, generationStatus: "ready" },
          updatedAt: new Date(),
        })
        .where(eq(skillSyncRoomsTable.id, roomId))
        .catch((updateError) => {
          req.log.error({ err: updateError, roomId }, "Could not finalize fallback learning paths");
        });
    }
  })();
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

  const [messages, submissions, activities, participants] = await Promise.all([
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
    roomActivities(context.room.id),
    db.select({
      userId: skillSyncProfilesTable.userId,
      displayName: skillSyncProfilesTable.displayName,
      teachSkill: skillSyncProfilesTable.teachSkill,
      learnSkill: skillSyncProfilesTable.learnSkill,
    }).from(skillSyncProfilesTable).where(inArray(skillSyncProfilesTable.userId, [context.match.userAId, context.match.userBId])),
  ]);
  res.json(
    GetSkillSyncRoomResponse.parse({
      roomId: context.room.id,
      partnerUserId: context.partner?.userId ?? "",
      partnerName: context.partner?.displayName ?? "Learning partner",
      projectTitle: context.room.projectTitle,
      status: context.room.status,
      progress: context.room.progress,
      isDemo: context.room.isDemo,
      participants,
      activities,
      curriculum: context.room.curriculum,
      challenge: context.room.challenge,
      messages: messages.map(messageDto),
      submissions: submissions.map(submissionDto),
      updatedAt: iso(context.room.updatedAt),
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
  if (context.room.status === "unmatched") { res.status(409).json({ error: "This room is read-only." }); return; }
  const locale = req.get("accept-language")?.toLowerCase().startsWith("ar") ? "ar" : "en";
  const sharedContext = await sharedRoomContext(context.room.id, res.locals.userId);
  const content = await generateDailyChallengeContent(
    context.room.curriculum,
    dayNumber,
    sharedContext ? await roomMemory(sharedContext) : undefined,
    locale,
  );
  await recordAiUse(res.locals.userId, "challenge", content.aiPowered, context.room.isDemo);
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
  const title = parsed.data.title.trim();
  const content = parsed.data.content.trim();
  if (!title || !content) {
    res.status(400).json({ error: "Add a project title and description before submitting." });
    return;
  }
  const context = await getRoomContext(params.data.roomId, res.locals.userId as string);
  if (!context) {
    res.status(404).json({ error: "Learning room not found." });
    return;
  }
  if (context.room.status === "unmatched") { res.status(409).json({ error: "This room is read-only." }); return; }
  const userId = res.locals.userId as string;
  const locale = req.get("accept-language")?.toLowerCase().startsWith("ar") ? "ar" : "en";
  const submission = await db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(skillSyncSubmissionsTable)
      .values({
        id: randomUUID(),
        roomId: context.room.id,
        title,
        content,
        ...fallbackProjectEvaluation(locale),
        evaluationStatus: "pending",
      })
      .returning();
    await tx
      .update(skillSyncRoomsTable)
      .set({ status: "completed", progress: 100, updatedAt: new Date() })
      .where(eq(skillSyncRoomsTable.id, context.room.id));
    return saved;
  });

  const evaluateInBackground = async (): Promise<void> => {
    try {
      const memoryContext = await sharedRoomContext(context.room.id, userId);
      const evaluation = await evaluateProjectContent(
        title,
        content,
        context.room.curriculum,
        memoryContext ? await roomMemory(memoryContext) : undefined,
        locale,
      );
      const evaluationStatus = evaluation.aiPowered ? "ready" : "fallback";
      await db
        .update(skillSyncSubmissionsTable)
        .set({ ...evaluation, evaluationStatus })
        .where(eq(skillSyncSubmissionsTable.id, submission.id));
      try {
        await recordAiUse(userId, "evaluation", evaluation.aiPowered, context.room.isDemo);
      } catch (error) {
        req.log.warn({ err: error, roomId: context.room.id }, "Could not record project-evaluation usage");
      }
    } catch (error) {
      req.log.warn(
        { err: error, roomId: context.room.id, userId },
        "Project saved; asynchronous AI evaluation will remain in fallback state",
      );
      await db
        .update(skillSyncSubmissionsTable)
        .set({ evaluationStatus: "fallback" })
        .where(eq(skillSyncSubmissionsTable.id, submission.id))
        .catch((updateError) => {
          req.log.error(
            { err: updateError, submissionId: submission.id },
            "Could not finalize fallback project evaluation",
          );
        });
    }
  };

  res.status(201).json(SubmitSkillSyncProjectResponse.parse(submissionDto(submission)));
  setImmediate(() => {
    void evaluateInBackground();
  });
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
