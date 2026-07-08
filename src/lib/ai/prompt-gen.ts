import { z } from "zod";
import { anthropic, MODELS } from "./claude";
import { resolveKnowledge, renderBlocks } from "./knowledge";

/**
 * PRD v3 Phase 8.1 — runtime prompt generation (PRD §9, decision D3
 * hybrid: curated banks are the backbone; runtime generation refreshes
 * and personalizes, validated against framework rules, then cached back
 * into the bank).
 *
 * Implements the shared core of the PRD's three Engine V1 specs: given
 * ONE exercise framework, produce N prompt options that all train the
 * same objective while varying only the topic. Wires the previously
 * dead `prompt_gen` knowledge stage as grounding.
 *
 * Pure generation + validation — persistence/cache-back lives in
 * src/server/lib/prompt-gen-cache.ts. Every failure path returns [] so
 * callers degrade to the curated bank (never a worse experience).
 */

export type PromptGenExercise = {
  slug: string;
  name: string;
  dimension: string;
  rule: string;
  why: string | null;
  objective: string | null;
  /** Framework prompt-generation rules (exercises.prompt_rules). */
  promptRules: string | null;
  hiddenSkills: string[] | null;
  application: string | null;
  responseWindow: { minSec: number; maxSec: number } | null;
};

export type PromptGenUserContext = {
  vertical?: string | null;
  communicationStage?: string | null;
  /** users.improvement_goals — biases scenario TOPICS toward what the
   *  user is working on; never changes the training objective. */
  goals?: string[] | null;
};

/** Bank convention (seed script PROMPT_MAX_CHARS). */
export const GENERATED_PROMPT_MAX_CHARS = 200;
export const GENERATED_PROMPT_MIN_CHARS = 20;

// Shape-only validation. Length/duplicate policing belongs to
// qaFilterPrompts — a single overlong prompt (or the model returning
// count+2 extras, which we explicitly ask for) must not void the whole
// batch. The old strict schema (.max(10) items, per-string length) did
// exactly that: every 12-prompt expansion batch zod-failed to 0 (11.D4).
const responseSchema = z.object({
  prompts: z.array(z.string()).min(1).max(30),
});

/** PRD §5.6 — the topic categories a healthy bank spans. */
export const TOPIC_CATEGORIES = [
  "business",
  "career",
  "technology",
  "sports",
  "current events",
  "personal development",
  "relationships",
  "culture",
  "everyday life",
] as const;

const systemPrompt = `You are Cognify's prompt architect. Given ONE exercise framework, generate speaking-prompt options that all train the SAME objective while varying ONLY the topic (PRD: "The surface topic may change. The training objective must stay the same.").

Every prompt must be:
- Spoken-response appropriate (a person answers out loud, solo)
- One or two sentences, ≤200 characters, no line breaks
- Clear in audience, setting, or stakes where the exercise calls for it
- Realistic enough to transfer to real communication
- Directly practicing the exercise's rule — a user following the rule should score well
- Free of theory names (no "SCQA", "Grice", "STAR" etc.) and free of meta-text ("Here's a prompt…")

UNIVERSALLY ANSWERABLE (hard rule): ANY adult must be able to answer truthfully from their own real life or common knowledge, in the response window, with no preparation. NEVER presume a specific possession, hobby, biographical event, job artifact, or relationship — no "your band", "your pet", "your garden", "the wedding you attended", "your first promotion", "your company's near-death story". Anchor prompts in experiences everyone has (a plan that fell apart, a decision you agonized over, a skill that took years, a disagreement that built up, something you know well) or in hypotheticals where the prompt itself supplies the position ("Make the case that…"). If a scenario would make even one user think "but that never happened to me", it is invalid.

Also (PRD Lab Engine rules): one main communication challenge per prompt — do not stack constraints; reward truthful, specific, grounded answers over polished-but-empty performance; the prompt must be answerable AGAIN immediately after coaching (no surprise, trivia, or one-time cleverness).

TOPIC SPREAD (PRD §5.6): unless the framework prompt rules pin the setting, spread the batch across DIFFERENT topic categories — ${TOPIC_CATEGORIES.join(", ")} — rather than clustering in workplace scenarios. Spread across professional, academic, leadership, social, and personal contexts. Refreshing changes the topic, never the objective.

Match the register of the exercise's existing prompts when examples are given. Do NOT reuse or lightly paraphrase the examples — produce genuinely fresh topics.

OUTPUT: ONLY valid JSON: { "prompts": ["...", "..."] }`;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
}

/** QA filter (D3: "validated against framework rules, QA filters"). */
export function qaFilterPrompts(
  candidates: string[],
  existingTexts: string[],
): string[] {
  const seen = new Set(existingTexts.map(normalize));
  const out: string[] = [];
  for (const raw of candidates) {
    const text = raw.trim().replace(/\s+/g, " ");
    if (
      text.length < GENERATED_PROMPT_MIN_CHARS ||
      text.length > GENERATED_PROMPT_MAX_CHARS
    ) {
      continue;
    }
    if (/\n/.test(raw)) continue;
    if (/as an ai|here (is|are)|prompt:|option \d/i.test(text)) continue;
    const norm = normalize(text);
    if (norm.length === 0 || seen.has(norm)) continue;
    // Near-duplicate guard: reject when ≥80% of the words already appear
    // in one existing prompt (cheap Jaccard-ish check, no embeddings).
    const words = new Set(norm.split(" "));
    let dup = false;
    for (const ex of seen) {
      const exWords = new Set(ex.split(" "));
      let overlap = 0;
      for (const w of words) if (exWords.has(w)) overlap++;
      if (overlap / Math.max(1, words.size) >= 0.8) {
        dup = true;
        break;
      }
    }
    if (dup) continue;
    seen.add(norm);
    out.push(text);
  }
  return out;
}

function inferDomainHint(ex: PromptGenExercise): string | undefined {
  if (ex.application === "storytelling") return "storytelling";
  if (ex.application === "interviewing") return "behavioral-interview";
  if (ex.application === "persuasion") return "negotiation";
  if (ex.application === "presenting" || ex.application === "teaching")
    return "exec-briefing";
  return undefined;
}

/** Assemble the generation user prompt. Exported (pure) so tests can
 *  assert the user-context lines actually render — the I1 audit found
 *  communicationStage/goals silently dropped at the only call site. */
export function buildGenUserPrompt(input: {
  exercise: PromptGenExercise;
  userContext?: PromptGenUserContext;
  existingTexts: string[];
  count: number;
}): string {
  const { exercise: ex, existingTexts, count } = input;
  return [
    `EXERCISE: ${ex.name} (core skill: ${ex.dimension}${ex.application ? `, application: ${ex.application}` : ""})`,
    `RULE THE USER PRACTICES: ${ex.rule}`,
    ex.why ? `WHY IT MATTERS: ${ex.why}` : null,
    ex.objective ? `COMMUNICATION OBJECTIVE: ${ex.objective}` : null,
    ex.promptRules ? `FRAMEWORK PROMPT RULES (follow exactly): ${ex.promptRules}` : null,
    ex.hiddenSkills?.length
      ? `HIDDEN SKILLS TRAINED: ${ex.hiddenSkills.join(", ")}`
      : null,
    ex.responseWindow
      ? `RESPONSE WINDOW: ${ex.responseWindow.minSec}-${ex.responseWindow.maxSec} seconds — prompts must be answerable in that window.`
      : null,
    input.userContext?.vertical
      ? `USER VERTICAL (bias topics toward, don't force): ${input.userContext.vertical}`
      : null,
    input.userContext?.communicationStage
      ? `USER CAREER STAGE: ${input.userContext.communicationStage}`
      : null,
    input.userContext?.goals?.length
      ? `USER GOALS (bias scenarios toward, don't force): ${input.userContext.goals.join(", ")}`
      : null,
    existingTexts.length > 0
      ? `EXISTING BANK EXAMPLES (match register, do NOT reuse topics):\n${existingTexts
          .slice(0, 8)
          .map((t) => `- ${t}`)
          .join("\n")}`
      : null,
    `Generate ${count + 2} prompt options (extras cover QA rejections).`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generatePrompts(input: {
  exercise: PromptGenExercise;
  userContext?: PromptGenUserContext;
  /** Existing bank texts — few-shot register examples + dedupe corpus. */
  existingTexts: string[];
  count: number;
}): Promise<string[]> {
  const { exercise: ex, existingTexts } = input;
  const count = Math.min(10, Math.max(1, input.count));

  const knowledgeText = renderBlocks(
    resolveKnowledge({ stage: "prompt_gen", domainHint: inferDomainHint(ex) }),
  );

  const userPrompt = buildGenUserPrompt({
    exercise: ex,
    ...(input.userContext ? { userContext: input.userContext } : {}),
    existingTexts,
    count,
  });

  try {
    const response = await anthropic.messages.create({
      model: MODELS.framework,
      // Scale with batch size: ~90 output tokens per ≤200-char prompt
      // plus JSON overhead. The old flat 1200 truncated 12-prompt
      // batches on GPT-4o → JSON parse failure → 0 generated (11.D4).
      max_tokens: Math.max(1200, 300 + (count + 2) * 120),
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
        ...(knowledgeText
          ? [
              {
                type: "text" as const,
                text: `DOMAIN GROUNDING:\n${knowledgeText}`,
                cache_control: { type: "ephemeral" as const },
              },
            ]
          : []),
      ],
      messages: [
        { role: "user", content: [{ type: "text", text: userPrompt }] },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return [];
    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");
    const parsed = responseSchema.parse(JSON.parse(cleaned));
    return qaFilterPrompts(parsed.prompts, existingTexts).slice(0, count);
  } catch (err) {
    // Best-effort by contract, but never silent — a systematic failure
    // here looked like "0 generated" across the whole 11.D4 expansion
    // run with nothing to diagnose.
    console.warn(
      `[prompt-gen] ${ex.slug}: generation failed —`,
      err instanceof Error ? `${err.name}: ${err.message.slice(0, 300)}` : err,
    );
    return [];
  }
}
