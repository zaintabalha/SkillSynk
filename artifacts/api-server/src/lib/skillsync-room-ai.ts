import { z } from "zod/v4";
import type { SkillSyncActivityContent } from "@workspace/db";
import { generateJson, sanitizeText } from "./skillsync-ai";
import type { roomMemory } from "./skillsync-room-service";

type Memory = Awaited<ReturnType<typeof roomMemory>>;
const question = z.object({ id: z.string(), prompt: z.string(), choices: z.array(z.string()).min(2).max(6), answerIndex: z.number().int().min(0), explanation: z.string() }).refine((q) => q.answerIndex < q.choices.length);
const contentSchema = z.object({
  questions: z.array(question).min(1).max(10).optional(),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })).min(1).max(20).optional(),
  simulator: z.object({ mode: z.enum(["coding", "language"]), scenario: z.string(), prompt: z.string(), starter: z.string(), expected: z.string(), hint: z.string() }).optional(),
});
export const callSummarySchema = z.object({
  takeaways: z.array(z.string().min(1).max(500)).min(1).max(6),
  terms: z.array(z.string().min(1).max(160)).max(10),
  corrections: z.array(z.string().min(1).max(500)).max(6),
  nextSteps: z.array(z.string().min(1).max(500)).min(1).max(6),
});
export type CallSummary = z.infer<typeof callSummarySchema>;

export async function generateCallCopilotText(
  action: "speaking_prompt" | "hint",
  transcript: string,
  locale: "en" | "ar",
  memory: Memory,
) {
  const language = locale === "ar" ? "Arabic" : "English";
  const task = action === "speaking_prompt"
    ? "Create one short, practical speaking prompt that alternates teaching and learning between these partners."
    : "Give a precise, concise rescue hint based only on the transcript. Explain or translate the last difficult term. Say when the transcript lacks enough evidence; do not invent context.";
  const result = await generateJson(
    `${task} Respond entirely in ${language}, without student names or provider names. Return JSON {"text":"..."}. Recent speech transcript: ${JSON.stringify(transcript)}. Full shared memory (profiles, plan, entire conversation): ${JSON.stringify(memory)}`,
  );
  const fallback = action === "speaking_prompt"
    ? locale === "ar"
      ? "مهمة نقاش: يشرح أحدكما فكرة من خطته في دقيقة، ثم يعيد الآخر شرحها بمثال من مشروعكما."
      : "Speaking prompt: one partner explains an idea from the plan in a minute; the other restates it with an example from your project."
    : locale === "ar"
      ? "التلميح التجريبي: قسّما الفكرة إلى خطوة صغيرة واشرحا معناها بكلماتكما. يحتاج التلميح المباشر إلى تفعيل الاتصال الآمن بالذكاء الاصطناعي."
      : "Demo hint: break the idea into one small step and explain it in your own words. A live tailored hint needs the secure AI connection.";
  return {
    text: sanitizeText(typeof result?.text === "string" ? result.text : fallback, memory.students),
    aiPowered: Boolean(result && typeof result.text === "string"),
  };
}

export async function generateCallSummary(
  transcript: string,
  locale: "en" | "ar",
  memory: Memory,
) {
  const language = locale === "ar" ? "Arabic" : "English";
  const result = await generateJson(
    `Summarize these study partners' call transcript in ${language}. Use only transcript evidence and their full shared learning memory. Do not invent errors. Return JSON {"takeaways":["..."],"terms":["..."],"corrections":["..."],"nextSteps":["..."]}; at least one takeaway and next step. Avoid personal names and provider names. Transcript: ${JSON.stringify(transcript)}. Shared memory: ${JSON.stringify(memory)}`,
  );
  const parsed = callSummarySchema.safeParse(result);
  if (parsed.success) {
    const clean = JSON.parse(sanitizeText(JSON.stringify(parsed.data), memory.students)) as CallSummary;
    return { summary: clean, aiPowered: true };
  }
  const excerpts = transcript.split(/(?<=[.!?؟۔])\s+/u).map((line) => line.trim()).filter(Boolean).slice(-2);
  const summary: CallSummary = locale === "ar"
    ? { takeaways: [excerpts[0] || "لم يتوفر نص كافٍ لتحديد ما تعلّمه الشريكان."], terms: [], corrections: [], nextSteps: ["راجعا الخطة المشتركة واختارا خطوة صغيرة تالية."] }
    : { takeaways: [excerpts[0] || "There was not enough transcript to identify a learning takeaway."], terms: [], corrections: [], nextSteps: ["Review the shared plan and choose one small next step."] };
  return { summary, aiPowered: false };
}

export async function answerRoomQuestion(prompt: string, memory: Memory, quoted?: string) {
  const result = await generateJson(
    `Answer this explicit student request using the complete shared room memory below. Respond in the request's language. If a quoted message is supplied, quote it and verify only what can be established; be clear about uncertainty. Return JSON {"answer":"..."}. Request: ${JSON.stringify(prompt)}. Quoted message: ${JSON.stringify(quoted ?? null)}. Shared memory: ${JSON.stringify(memory)}`,
  );
  const answer = typeof result.answer === "string" ? result.answer.trim() : "";
  if (!answer) throw new Error("Gemini returned no answer for the @AI request.");
  return { answer: sanitizeText(answer, memory.students), aiPowered: true };
}

export async function generateRoomActivity(kind: "quiz" | "flashcards" | "simulator", prompt: string, memory: Memory) {
  const topic = memory.curriculum.title;
  const fallback: SkillSyncActivityContent = kind === "quiz" ? {
    questions: [
      { id: "q1", prompt: `What is the best first step for ${topic}?`, choices: ["Agree on one small, testable goal", "Build unrelated parts without discussing them", "Skip partner feedback"], answerIndex: 0, explanation: "A shared, testable goal keeps both skills connected." },
      { id: "q2", prompt: "How should partners check a disputed explanation?", choices: ["Assume the more confident partner is correct", "Use a reliable source or a reproducible example", "Ignore the disagreement"], answerIndex: 1, explanation: "Evidence and reproducible examples make verification useful." },
      { id: "q3", prompt: "What makes a useful project handoff?", choices: ["Only a finished file", "No explanation", "A working example, clear instructions, and known limitations"], answerIndex: 2, explanation: "A handoff should let the other partner understand and use the result." },
    ],
  } : kind === "flashcards" ? {
    flashcards: [
      { front: "Shared project goal", back: memory.curriculum.goal },
      { front: "First learning stage", back: memory.curriculum.stages[0] ?? "Agree on a small goal." },
      { front: "Useful peer feedback", back: "Describe a specific observation, explain its effect, and suggest a testable improvement." },
    ],
  } : {
    simulator: { mode: "language", scenario: `Explain one part of ${topic} to a new partner.`, prompt: "Rewrite an unclear handoff into one precise sentence.", starter: "Do the thing and send it.", expected: "Please review the first example and send one specific improvement.", hint: "Name the action, the object, and the expected feedback." },
  };
  const result = await generateJson(
    `Create a ${kind} grounded in the students' whole conversation and plan. Request: ${JSON.stringify(prompt)}. Return JSON {"title":"...","instructions":"...","content":...}. For quiz, content is {"questions":[{"id":"q1","prompt":"...","choices":["...","..."],"answerIndex":0,"explanation":"..."}]}; for flashcards, {"flashcards":[{"front":"...","back":"..."}]}; for simulator, {"simulator":{"mode":"coding or language","scenario":"...","prompt":"...","starter":"...","expected":"...","hint":"..."}}. Coding simulations are text exercises, not executable code. Shared memory: ${JSON.stringify(memory)}`,
  );
  const parsed = contentSchema.safeParse(result?.content);
  const key = kind === "quiz" ? "questions" : kind;
  const valid = parsed.success && Boolean(parsed.data[key]);
  const content = valid && parsed.success ? parsed.data : fallback;
  const cleaned = JSON.parse(sanitizeText(JSON.stringify(content), memory.students)) as SkillSyncActivityContent;
  return {
    title: sanitizeText(valid && typeof result?.title === "string" ? result.title : `Shared ${kind}: ${topic}`, memory.students),
    instructions: sanitizeText(valid && typeof result?.instructions === "string" ? result.instructions : "Demo practice: work through this together and compare your reasoning.", memory.students),
    content: cleaned, aiPowered: Boolean(valid),
  };
}
