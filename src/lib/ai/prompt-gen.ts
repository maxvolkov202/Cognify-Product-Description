import { z } from "zod";
import { anthropic, MODELS } from "./claude";
import { resolveKnowledge, renderBlocks } from "./knowledge";
import {
  canonicalizeSubSkillId,
  SUB_SKILL_DEFINITIONS,
  SUB_SKILL_LABELS,
} from "@/types/sub-skills";

/**
 * System Change v2 Phase 2A (D21, D23) — prompt generation engine on the
 * doc's Engine V1 specs (PRD "Daily Work Engine V1" + "The Lab Engine V1"
 * + §9.3, §9.4, §11.3, docs/prompt-design-canon.md).
 *
 * The generation unit is the full exercise framework:
 *   core skill → hidden behaviors (taxonomy v2) → coach's insight →
 *   prompt options (slate = 5, D21) → scoring lens → retry instruction.
 *
 * Three entry points:
 *   - generatePrompts     — topic-only refresh for an existing framework
 *                           (runtime top-up path; the objective never changes,
 *                           only the topic — PRD §9.3).
 *   - generatePromptPack  — the whole unit at once (tooling / manifest
 *                           authoring; emits coach insight, scoring lens,
 *                           retry objective alongside the prompt options).
 *   - verifyPromptsCanon  — LLM canon QA pass (Phase 2A.2): judges prompts
 *                           against the prompt-design canon (no personas, no
 *                           required setup, no jargon walls, answerable by
 *                           anyone) — regex QA alone can't catch these.
 *
 * Pure generation + validation — persistence/cache-back lives in
 * src/server/lib/prompt-gen-cache.ts. Every failure path returns []/null so
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
  /** Pack fields (Lab Engine V1) — rendered into generation context when
   *  authored so new prompts serve the same coaching arc. */
  coachInsight?: string | null;
  scoringLens?: string | null;
  retryObjective?: string | null;
  commonFailureModes?: string[] | null;
  secondaryCoreSkills?: string[] | null;
};

export type PromptGenUserContext = {
  vertical?: string | null;
  communicationStage?: string | null;
  /** users.improvement_goals — biases scenario TOPICS toward what the
   *  user is working on; never changes the training objective. */
  goals?: string[] | null;
};

/** Bank convention (seed script PROMPT_MAX_CHARS). Canon aims ≤180; 200 is
 *  the hard cap so near-canon prompts aren't voided by a few characters. */
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

/**
 * The universality hard rule + canon distillation shared by generation and
 * verification so the generator and the judge can never drift apart.
 * (docs/prompt-design-canon.md; PRD §9.3.2, §11.3, Lab Engine V1 style rules.)
 */
const CANON_RULES = `UNIVERSALLY ANSWERABLE (hard rule): ANY adult must be able to answer truthfully from their own real life or common knowledge, within the response window, with no preparation. NEVER presume a specific possession, hobby, biographical event, job artifact, credential, or relationship — no "your band", "your pet", "your garden", "the wedding you attended", "your first promotion", "your company's near-death story". Anchor prompts in experiences everyone has (a plan that fell apart, a decision you agonized over, a skill that took years, a disagreement that built up, something you know well) or in hypotheticals where the prompt itself supplies the position ("Make the case that…"). If a scenario would make even one user think "but that never happened to me", it is invalid.

THE 3-SECOND TEST: a great prompt makes the user think "I know exactly what I'd say" and start speaking within seconds. No imagined meeting to construct, no missing context, no research. The challenge comes from HOW the user communicates, never from understanding the prompt.

NO PERSONAS OR UNREALISTIC ROLEPLAY: never make the user pretend to hold beliefs, credentials, or experiences they may not have. A named audience is fine ("to a friend", "to a busy manager") when anyone can address it from real life; a required identity is not.

NO JARGON WALLS: no insider terms, acronyms, or domain setups the user must already know (no "MEDDPICC", "Daubert", "goodwill impairment KAM"). Vertical flavor affects subject matter and reference points, never required knowledge.

TONE: conversational invitation, not exam question or homework assignment. Provocative beats bland. Second person. One or two sentences, ≤200 characters, aim for ≤180, no line breaks.

ONE CHALLENGE: one main communication challenge per prompt — do not stack constraints, audiences, emotional dynamics, and content requirements.

RETRYABLE: the user must be able to answer once, receive coaching, and immediately try again with a clearer target — no surprise, trivia, or one-time cleverness. Reward truthful, specific, grounded answers over polished-but-empty performance.`;

/** Per-application generation rules from The Lab Engine V1 spec. */
const APPLICATION_RULES: Record<string, string> = {
  storytelling:
    "STORYTELLING RULES: make the moment of change, stakes, or lesson clear in the prompt. Imply a story arc (setup → tension → change → takeaway) without naming frameworks. The story must be drawable from real experience every adult has — never a specific required event.",
  presenting:
    "PRESENTING RULES: make the audience and purpose clear. Imply a main message, supporting points, and implication. Keep the audience one anyone can address (a busy listener, a small group) — no invented org charts.",
  teaching:
    "TEACHING RULES: make the learner's starting point clear (what they currently understand or misunderstand). Imply definition, analogy, example, and application. The concept taught must be common knowledge or supplied by the prompt itself.",
  interviewing:
    "INTERVIEWING RULES: make the role, setting, and what is being evaluated clear — generically (\"a selective internship\", \"a role you want\"), never a specific company or credential. Imply an evidence-based answer (a specific moment proving the trait) drawn from any real experience — school, work, team, family.",
  persuasion:
    "PERSUASION RULES: make the audience's priorities clear so the user can choose audience-relevant reasons. Imply decision-first framing with a concrete ask. The position argued must be supplied by the prompt or genuinely holdable by anyone.",
};

/** Shared generation-rules body — systemPrompt and packSystemPrompt
 *  compose from this so the two can never drift. */
const GENERATION_RULES = `You are Cognify's prompt architect. Cognify is a communication gym: focused speaking reps, immediate feedback, retry, measurable improvement. Given ONE exercise framework, generate speaking-prompt options that all train the SAME core skill, the SAME hidden behaviors, and the SAME communication objective while varying ONLY the topic (PRD: "The surface topic may change. The training objective must stay the same.").

The generation unit you serve is: core skill → hidden behaviors → coach's insight → prompt options → scoring lens → retry instruction. The prompts you write must fit that whole arc: a user who follows the exercise's rule and the coach's insight should score well under the scoring lens, and be able to retry the same prompt after coaching.

Every prompt must be:
- Spoken-response appropriate (a person answers out loud, solo)
- Clear in audience, setting, or stakes where the exercise calls for it
- Realistic enough to transfer to real communication
- Focused on the exercise's one primary skill — a prompt that ignores the mechanic dilutes the training
- Challenging but not overwhelming; suitable for the response window
- Free of theory names (no "SCQA", "Grice", "STAR", "PREP", "Minto" etc.) and free of meta-text ("Here's a prompt…") — use communication theory implicitly, never academically

${CANON_RULES}

TOPIC SPREAD (PRD §5.6, §9.4.1): unless the framework prompt rules pin the setting, spread the batch across DIFFERENT topic categories — ${TOPIC_CATEGORIES.join(", ")} — and across different conversation kinds (personal experience, workplace, everyday life, hypothetical, lighthearted, reflective). Prompts shown together should feel meaningfully different. Refreshing changes the topic, never the objective.

Match the register of the exercise's existing prompts when examples are given. Do NOT reuse or lightly paraphrase the examples — produce genuinely fresh topics.`;

const systemPrompt = `${GENERATION_RULES}

OUTPUT: ONLY valid JSON: { "prompts": ["...", "..."] }`;

/** Normalize prompt text for dedupe/matching. Exported so offline
 *  tooling (audit-canon-llm) matches with the exact same normalizer. */
export function normalizePromptText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
}
const normalize = normalizePromptText;

/** Deterministic QA filter (shape, length, dupes). The canon-judgment QA
 *  lives in verifyPromptsCanon — this stage only rejects what regex can. */
export function qaFilterPrompts(
  candidates: string[],
  existingTexts: string[],
): string[] {
  const seen = new Set(existingTexts.map(normalize));
  // Word sets are built ONCE per corpus entry rather than re-split for
  // every candidate — this path is user-blocking and a mature exercise
  // bank runs to several hundred prompts.
  const seenWords: Array<Set<string>> = [...seen].map(
    (s) => new Set(s.split(" ")),
  );
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
    // Near-duplicate guard: reject when ≥80% of EITHER prompt's words
    // appear in the other (cheap containment check, no embeddings).
    //
    // Checking only the candidate side missed the dominant real-world
    // dupe shape — a candidate that EXTENDS an existing prompt. The bank
    // is full of survivors: "What's worth fighting for?" alongside
    // "What's worth fighting for in a friendship?", "Is honesty always
    // the right call?" alongside "…the right call in a relationship?".
    // The longer text dilutes its own overlap ratio below the threshold
    // and sails through. The reverse direction only applies to existing
    // prompts of ≥5 words, so a terse stub ("What's the point?") can't
    // veto every candidate that happens to contain it. At 4 tokens the
    // 0.8 threshold demands FULL containment, which is a real dupe
    // signal; 3-token stubs stay exempt.
    const words = new Set(norm.split(" "));
    const REVERSE_MIN_WORDS = 4;
    let dup = false;
    for (const exWords of seenWords) {
      let overlap = 0;
      for (const w of words) if (exWords.has(w)) overlap++;
      if (
        overlap / Math.max(1, words.size) >= 0.8 ||
        (exWords.size >= REVERSE_MIN_WORDS && overlap / exWords.size >= 0.8)
      ) {
        dup = true;
        break;
      }
    }
    if (dup) continue;
    seen.add(norm);
    seenWords.push(words);
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

function renderHiddenSkills(ids: string[]): string {
  return ids
    .map((id) => {
      // Catalog rows on an unreseeded DB may carry pre-v2 ids —
      // canonicalize so they still render label + definition.
      const skillId = canonicalizeSubSkillId(id);
      return skillId
        ? `- ${SUB_SKILL_LABELS[skillId]} — ${SUB_SKILL_DEFINITIONS[skillId]}`
        : `- ${id.replace(/_/g, " ")}`;
    })
    .join("\n");
}

/** Render the exercise framework as generation context — the whole unit,
 *  not just the rule, so prompts serve the same coaching arc. */
function renderExerciseContext(ex: PromptGenExercise): string[] {
  return [
    `EXERCISE: ${ex.name} (core skill: ${ex.dimension}${ex.application ? `, application: ${ex.application}` : ""})`,
    `RULE THE USER PRACTICES: ${ex.rule}`,
    ex.why ? `WHY IT MATTERS: ${ex.why}` : null,
    ex.objective ? `COMMUNICATION OBJECTIVE: ${ex.objective}` : null,
    ex.coachInsight ? `COACH'S INSIGHT (shown before speaking): ${ex.coachInsight}` : null,
    ex.scoringLens ? `SCORING LENS (how the response is evaluated): ${ex.scoringLens}` : null,
    ex.retryObjective ? `RETRY OBJECTIVE: ${ex.retryObjective}` : null,
    ex.commonFailureModes?.length
      ? `COMMON FAILURE MODES (prompts should make these visible):\n${ex.commonFailureModes.map((m) => `- ${m}`).join("\n")}`
      : null,
    ex.promptRules ? `FRAMEWORK PROMPT RULES (follow exactly): ${ex.promptRules}` : null,
    ex.hiddenSkills?.length
      ? `HIDDEN SKILLS TRAINED (target these behaviors):\n${renderHiddenSkills(ex.hiddenSkills)}`
      : null,
    ex.secondaryCoreSkills?.length
      ? `SECONDARY CORE SKILLS: ${ex.secondaryCoreSkills.join(", ")}`
      : null,
    ex.responseWindow
      ? `RESPONSE WINDOW: ${ex.responseWindow.minSec}-${ex.responseWindow.maxSec} seconds — prompts must be answerable in that window.`
      : null,
    ex.application && APPLICATION_RULES[ex.application]
      ? APPLICATION_RULES[ex.application]
      : null,
  ].filter((line): line is string => Boolean(line));
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
    ...renderExerciseContext(ex),
    input.userContext?.vertical
      ? `USER VERTICAL (bias topics toward, don't force — vertical-flavored, never vertical-locked): ${input.userContext.vertical}`
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
    const parsed = responseSchema.parse(JSON.parse(stripFences(textBlock.text)));
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

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");
}

// ————————————————————————————————————————————————————————————————
// Phase 2A.2 — LLM canon verification pass
// ————————————————————————————————————————————————————————————————

export type CanonVerdict = {
  /** Index into the submitted prompts array. */
  index: number;
  ok: boolean;
  /** Short violation tags when not ok (e.g. "required-setup",
   *  "persona", "jargon-wall", "not-universal", "mechanic-mismatch"). */
  violations: string[];
};

const verifySchema = z.object({
  verdicts: z
    .array(
      z.object({
        index: z.number().int().min(0),
        ok: z.boolean(),
        // The judge is instructed with 8 valid tags — cap above that so
        // a maximally-tagged verdict can't zod-fail the whole batch
        // (which would fail the runtime path OPEN and cache the very
        // prompt the judge condemned).
        violations: z.array(z.string()).max(10),
      }),
    )
    .min(1),
});

const verifySystemPrompt = `You are Cognify's prompt-canon judge. You receive speaking prompts for one exercise framework and decide, per prompt, whether it obeys the prompt-design canon. Judge each prompt INDEPENDENTLY and be strict — a violating prompt that ships wastes a user's rep.

${CANON_RULES}

MECHANIC FIT: the prompt must naturally pull the exercise's rule — following the rule should be the path of least resistance, not extra discipline bolted onto an unrelated question.

Violation tags (use these exact strings): "required-setup" (user must imagine/invent a specific scene, meeting, or context), "persona" (requires pretending to a role, belief, credential, or experience the user may not have), "not-universal" (presumes a possession, biographical event, job artifact, or relationship not everyone has), "jargon-wall" (requires insider terms or domain knowledge to even understand), "mechanic-mismatch" (does not exercise the framework's rule), "exam-tone" (reads as homework/assignment, not a conversational invitation), "stacked-constraints" (more than one main communication challenge), "not-retryable" (depends on surprise, trivia, or one-time cleverness).

A prompt with zero violations gets ok=true and an empty violations array. Be strict on the universality rule; be lenient on tone judgment calls (only tag exam-tone when it clearly reads as an assignment).

OUTPUT: ONLY valid JSON: { "verdicts": [{ "index": 0, "ok": true, "violations": [] }, ...] } — exactly one verdict per submitted prompt, index matching the submitted numbering.`;

/**
 * LLM canon QA (2A.2). Returns one verdict per prompt, or null when the
 * judge itself failed (callers decide the failure policy: the runtime
 * cache-back path fails OPEN with a log so a judge outage never empties
 * slates; the offline audit script fails CLOSED and retries).
 */
export async function verifyPromptsCanon(input: {
  prompts: string[];
  exercise: Pick<
    PromptGenExercise,
    "name" | "dimension" | "rule" | "application" | "responseWindow"
  >;
}): Promise<CanonVerdict[] | null> {
  if (input.prompts.length === 0) return [];
  const ex = input.exercise;
  const userPrompt = [
    `EXERCISE: ${ex.name} (core skill: ${ex.dimension}${ex.application ? `, application: ${ex.application}` : ""})`,
    `RULE THE USER PRACTICES: ${ex.rule}`,
    ex.responseWindow
      ? `RESPONSE WINDOW: ${ex.responseWindow.minSec}-${ex.responseWindow.maxSec} seconds`
      : null,
    `PROMPTS TO JUDGE:`,
    ...input.prompts.map((p, i) => `${i}. ${p}`),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: MODELS.framework,
      max_tokens: Math.max(800, 200 + input.prompts.length * 60),
      system: [
        {
          type: "text",
          text: verifySystemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: [{ type: "text", text: userPrompt }] },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    const parsed = verifySchema.parse(JSON.parse(stripFences(textBlock.text)));
    // Normalize: one verdict per prompt; missing indices fail CLOSED
    // (unjudged = not ok) so a truncated judge response can't wave
    // violators through.
    const byIndex = new Map(parsed.verdicts.map((v) => [v.index, v]));
    return input.prompts.map((_, i) => {
      const v = byIndex.get(i);
      return v
        ? { index: i, ok: v.ok, violations: v.violations }
        : { index: i, ok: false, violations: ["unjudged"] };
    });
  } catch (err) {
    console.warn(
      `[prompt-gen] canon verify failed —`,
      err instanceof Error ? `${err.name}: ${err.message.slice(0, 300)}` : err,
    );
    return null;
  }
}

// ————————————————————————————————————————————————————————————————
// Phase 2A.1 — full generation-unit pack (tooling / manifest authoring)
// ————————————————————————————————————————————————————————————————

export type GeneratedPromptPack = {
  coachInsight: string;
  prompts: string[];
  scoringLens: string;
  retryObjective: string;
  commonFailureModes: string[];
};

const packSchema = z.object({
  coachInsight: z.string().min(10).max(300),
  prompts: z.array(z.string()).min(1).max(30),
  scoringLens: z.string().min(10).max(600),
  retryObjective: z.string().min(10).max(400),
  commonFailureModes: z.array(z.string().min(5).max(200)).min(2).max(5),
});

const packSystemPrompt = `${GENERATION_RULES}

You are generating the FULL exercise unit, not just prompts (PRD Engine V1 output contract):

- coachInsight: 1-2 sentences the user reads before speaking. Specific, memorable, immediately usable. Give a behavior to perform, not theory. Written like a communication coach, never an academic. No theory names.
- prompts: the prompt options (rules above).
- scoringLens: what the AI coach should evaluate in the response. Under-the-hood text — communication theory MAY be referenced explicitly here (Grice, cognitive load, BLUF etc.).
- retryObjective: after noting common missteps, one instruction asking the user to attempt the same prompt again while improving the single highest-leverage behavior. Under-the-hood text.
- commonFailureModes: 2-4 short, transcript-observable failures for this exercise.

OUTPUT: ONLY valid JSON:
{ "coachInsight": "...", "prompts": ["..."], "scoringLens": "...", "retryObjective": "...", "commonFailureModes": ["..."] }`;

/**
 * Generate the doc's full generation unit for one framework. Tooling path
 * (manifest enrichment, new-exercise authoring) — NOT called at runtime,
 * so it may be slower and is allowed to fail loudly (returns null).
 */
export async function generatePromptPack(input: {
  exercise: PromptGenExercise;
  existingTexts: string[];
  count: number;
}): Promise<GeneratedPromptPack | null> {
  const count = Math.min(20, Math.max(1, input.count));
  const userPrompt = buildGenUserPrompt({
    exercise: input.exercise,
    existingTexts: input.existingTexts,
    count,
  });
  try {
    const response = await anthropic.messages.create({
      model: MODELS.framework,
      max_tokens: Math.max(2000, 900 + (count + 2) * 120),
      system: [
        {
          type: "text",
          text: packSystemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: [{ type: "text", text: userPrompt }] },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    const parsed = packSchema.parse(JSON.parse(stripFences(textBlock.text)));
    const prompts = qaFilterPrompts(parsed.prompts, input.existingTexts).slice(
      0,
      count,
    );
    if (prompts.length === 0) return null;
    return { ...parsed, prompts };
  } catch (err) {
    console.warn(
      `[prompt-gen] ${input.exercise.slug}: pack generation failed —`,
      err instanceof Error ? `${err.name}: ${err.message.slice(0, 300)}` : err,
    );
    return null;
  }
}
