import type { RepTypeId } from "@/lib/ai/rep-types";
import type { VerticalId } from "@/lib/onboarding/constants";
import {
  pickVerticalPrompts,
  pickVerticalPromptObjects,
  verticalBankSize,
} from "./verticals";
import type { VerticalPrompt, WorkoutPrompt, WorkoutTheme } from "./types";

/**
 * Daily Workout prompt bank.
 *
 * Per the team spec: Daily Workout prompts are **general**, not vertical-
 * specific. Life, health, habits, communication — topics everyone can
 * engage with regardless of career. Verticalized prompts live in
 * src/lib/ai/prompts/verticals.ts and power the Build a Rep flow.
 *
 * Each rep type's bank is keyed by `RepTypeId` and stores `WorkoutPrompt`
 * objects with a stable `id` and a `theme` tag. The id is `${repType}_NNN`
 * zero-padded so ordering is stable across diffs. Themes drive stratified
 * sampling (Phase B) — three buckets only (work / life / abstract) so
 * authoring doesn't drown in taxonomy.
 *
 * Authoring rules:
 *   - Concrete: name the setting, audience, stakes. No abstract "talk about X".
 *   - Realistic: lines a real person would actually say.
 *   - General-life flavored: workout prompts are not vertical-gated.
 *   - Pick one theme per prompt — don't try to cover all three at once.
 */

export const WORKOUT_PROMPTS: Record<RepTypeId, readonly WorkoutPrompt[]> = {
  simplify: [
    { id: "simplify_001", text: "Explain how the internet works to someone who has never used it", theme: "abstract" },
    { id: "simplify_002", text: "Explain how money works to a child", theme: "life" },
    { id: "simplify_003", text: "Explain how exercise helps the body", theme: "life" },
    { id: "simplify_004", text: "Explain how habits are formed", theme: "life" },
    { id: "simplify_005", text: "Explain how sleep affects your energy", theme: "life" },
    { id: "simplify_006", text: "Explain how airplanes stay in the air", theme: "abstract" },
    { id: "simplify_007", text: "Explain why the sky is blue", theme: "abstract" },
    { id: "simplify_008", text: "Explain how a smartphone takes a photo", theme: "abstract" },
    { id: "simplify_009", text: "Explain what electricity is", theme: "abstract" },
    { id: "simplify_010", text: "Explain how language learning works in the brain", theme: "abstract" },
    { id: "simplify_011", text: "Explain what the stock market is", theme: "abstract" },
    { id: "simplify_012", text: "Explain how a refrigerator keeps food cold", theme: "abstract" },
    { id: "simplify_013", text: "Explain why we dream", theme: "abstract" },
    { id: "simplify_014", text: "Explain what AI actually does", theme: "abstract" },
    { id: "simplify_015", text: "Explain how vaccines work", theme: "abstract" },
    { id: "simplify_016", text: "Explain how interest compounds", theme: "abstract" },
    { id: "simplify_017", text: "Explain why bread rises", theme: "abstract" },
    { id: "simplify_018", text: "Explain how GPS knows where you are", theme: "abstract" },
    { id: "simplify_019", text: "Explain how a battery stores energy", theme: "abstract" },
    { id: "simplify_020", text: "Explain why salt melts ice", theme: "abstract" },
    { id: "simplify_021", text: "Explain how WiFi works", theme: "abstract" },
    { id: "simplify_022", text: "Explain what inflation actually is", theme: "abstract" },
    { id: "simplify_023", text: "Explain how a vaccine teaches your body", theme: "abstract" },
    { id: "simplify_024", text: "Explain why earthquakes happen", theme: "abstract" },
    { id: "simplify_025", text: "Explain how sound travels", theme: "abstract" },
    { id: "simplify_026", text: "Explain what gravity is to a six-year-old", theme: "abstract" },
    { id: "simplify_027", text: "Explain how seasons happen", theme: "abstract" },
    { id: "simplify_028", text: "Explain why ice floats on water", theme: "abstract" },
    { id: "simplify_029", text: "Explain how a credit card actually works", theme: "abstract" },
    { id: "simplify_030", text: "Explain how memories are stored", theme: "abstract" },
    { id: "simplify_031", text: "Explain why we get goosebumps", theme: "abstract" },
    { id: "simplify_032", text: "Explain how DNA carries information", theme: "abstract" },
    { id: "simplify_033", text: "Explain what a recession means for everyday life", theme: "abstract" },
    { id: "simplify_034", text: "Explain how a microwave heats food", theme: "abstract" },
    { id: "simplify_035", text: "Explain how solar panels turn light into power", theme: "abstract" },
    { id: "simplify_036", text: "Explain how a search engine ranks results", theme: "abstract" },
    { id: "simplify_037", text: "Explain why some sounds give people chills", theme: "abstract" },
    { id: "simplify_038", text: "Explain how the immune system fights a cold", theme: "abstract" },
    { id: "simplify_039", text: "Explain how weather forecasts get made", theme: "abstract" },
    { id: "simplify_040", text: "Explain how a car engine works in plain terms", theme: "abstract" },
    { id: "simplify_041", text: "Explain how caffeine wakes you up", theme: "life" },
    { id: "simplify_042", text: "Explain why stretching matters as you age", theme: "life" },
    { id: "simplify_043", text: "Explain how meal prep saves money", theme: "life" },
    { id: "simplify_044", text: "Explain how compound interest helps savings", theme: "life" },
    { id: "simplify_045", text: "Explain why protein matters at every meal", theme: "life" },
    { id: "simplify_046", text: "Explain how strength training reshapes the body", theme: "life" },
    { id: "simplify_047", text: "Explain why deep sleep matters more than total sleep", theme: "life" },
    { id: "simplify_048", text: "Explain how breathing slowly calms anxiety", theme: "life" },
    { id: "simplify_049", text: "Explain why hydration affects your energy", theme: "life" },
    { id: "simplify_050", text: "Explain how journaling clears your head", theme: "life" },
    { id: "simplify_051", text: "Explain how walking changes your mood", theme: "life" },
    { id: "simplify_052", text: "Explain why a bad night's sleep ruins your judgment", theme: "life" },
    { id: "simplify_053", text: "Explain why goals fail without systems", theme: "life" },
    { id: "simplify_054", text: "Explain how fasting affects your metabolism", theme: "life" },
    { id: "simplify_055", text: "Explain how reading aloud helps comprehension", theme: "life" },
    { id: "simplify_056", text: "Explain how a budget protects your future self", theme: "life" },
    { id: "simplify_057", text: "Explain why willpower runs out by evening", theme: "life" },
    { id: "simplify_058", text: "Explain how naming a feeling reduces its grip", theme: "life" },
    { id: "simplify_059", text: "Explain why morning sunlight resets your sleep", theme: "life" },
    { id: "simplify_060", text: "Explain how friction kills good habits", theme: "life" },
    { id: "simplify_061", text: "Explain how a deadline raises your performance", theme: "work" },
    { id: "simplify_062", text: "Explain how a 1:1 actually creates value", theme: "work" },
    { id: "simplify_063", text: "Explain why retros work even when teams hate them", theme: "work" },
    { id: "simplify_064", text: "Explain how scope creep ruins projects", theme: "work" },
    { id: "simplify_065", text: "Explain how a team's velocity gets measured", theme: "work" },
    { id: "simplify_066", text: "Explain how a code review prevents bugs", theme: "work" },
    { id: "simplify_067", text: "Explain why writing things down makes you faster", theme: "work" },
    { id: "simplify_068", text: "Explain how a roadmap differs from a plan", theme: "work" },
    { id: "simplify_069", text: "Explain how a meeting becomes a decision", theme: "work" },
    { id: "simplify_070", text: "Explain how status updates compound trust", theme: "work" },
    { id: "simplify_071", text: "Explain how interest rates affect a small business", theme: "abstract" },
    { id: "simplify_072", text: "Explain how a recommendation algorithm picks what you see", theme: "abstract" },
    { id: "simplify_073", text: "Explain how vaccines reach kids in remote villages", theme: "abstract" },
    { id: "simplify_074", text: "Explain how nutrition labels can mislead you", theme: "life" },
    { id: "simplify_075", text: "Explain how taxes get spent in a city budget", theme: "abstract" },
  ],
  structure: [
    { id: "structure_001", text: "Why is communication important in everyday life?", theme: "abstract" },
    { id: "structure_002", text: "What makes a good leader?", theme: "work" },
    { id: "structure_003", text: "Why is staying healthy important?", theme: "life" },
    { id: "structure_004", text: "What makes a strong team?", theme: "work" },
    { id: "structure_005", text: "Why is learning new skills important?", theme: "life" },
    { id: "structure_006", text: "What makes a city livable?", theme: "abstract" },
    { id: "structure_007", text: "Why do routines matter?", theme: "life" },
    { id: "structure_008", text: "What defines a successful career?", theme: "work" },
    { id: "structure_009", text: "Why is sleep non-negotiable?", theme: "life" },
    { id: "structure_010", text: "What makes feedback effective?", theme: "work" },
    { id: "structure_011", text: "Why does reading matter?", theme: "life" },
    { id: "structure_012", text: "What separates good decisions from bad ones?", theme: "abstract" },
    { id: "structure_013", text: "Why do some habits stick and others don't?", theme: "life" },
    { id: "structure_014", text: "What makes a meeting productive?", theme: "work" },
    { id: "structure_015", text: "Why is trust the foundation of every relationship?", theme: "life" },
    { id: "structure_016", text: "Why does feedback fail more often than it lands?", theme: "work" },
    { id: "structure_017", text: "What separates a good 1:1 from a wasted one?", theme: "work" },
    { id: "structure_018", text: "Why do most strategies die in execution, not planning?", theme: "work" },
    { id: "structure_019", text: "What makes a hire stick past their first year?", theme: "work" },
    { id: "structure_020", text: "Why do fast teams write more, not less?", theme: "work" },
    { id: "structure_021", text: "What makes one engineer ten times more effective than another?", theme: "work" },
    { id: "structure_022", text: "Why is decision-making slower in larger companies?", theme: "work" },
    { id: "structure_023", text: "What separates good middle managers from bad ones?", theme: "work" },
    { id: "structure_024", text: "Why do most reorgs fail to fix what they were meant to fix?", theme: "work" },
    { id: "structure_025", text: "What makes a roadmap credible vs aspirational?", theme: "work" },
    { id: "structure_026", text: "Why do meetings expand to fill the calendar?", theme: "work" },
    { id: "structure_027", text: "What makes a strong onboarding in the first 30 days?", theme: "work" },
    { id: "structure_028", text: "Why do priorities erode in busy weeks?", theme: "work" },
    { id: "structure_029", text: "What separates a leader from a manager?", theme: "work" },
    { id: "structure_030", text: "Why is the hardest part of strategy saying no?", theme: "work" },
    { id: "structure_031", text: "Why does saying no protect what matters?", theme: "life" },
    { id: "structure_032", text: "What makes a friendship last decades?", theme: "life" },
    { id: "structure_033", text: "Why is consistency more powerful than intensity?", theme: "life" },
    { id: "structure_034", text: "What makes someone a good listener?", theme: "life" },
    { id: "structure_035", text: "Why do most diets fail by month three?", theme: "life" },
    { id: "structure_036", text: "What makes an apology actually land?", theme: "life" },
    { id: "structure_037", text: "Why is patience a skill, not a personality trait?", theme: "life" },
    { id: "structure_038", text: "What separates a real friend from an acquaintance?", theme: "life" },
    { id: "structure_039", text: "Why does writing things down change how you think?", theme: "life" },
    { id: "structure_040", text: "What makes morning routines stick when nothing else does?", theme: "life" },
    { id: "structure_041", text: "Why do conversations with parents get easier as you age?", theme: "life" },
    { id: "structure_042", text: "What makes a partner worth committing to?", theme: "life" },
    { id: "structure_043", text: "Why is asking for help harder than offering it?", theme: "life" },
    { id: "structure_044", text: "What makes someone resilient under setbacks?", theme: "life" },
    { id: "structure_045", text: "Why does doing less often produce more?", theme: "life" },
    { id: "structure_046", text: "What makes a person worth listening to?", theme: "abstract" },
    { id: "structure_047", text: "Why is curiosity a renewable advantage?", theme: "abstract" },
    { id: "structure_048", text: "What separates wisdom from intelligence?", theme: "abstract" },
    { id: "structure_049", text: "Why do most predictions get the future wrong?", theme: "abstract" },
    { id: "structure_050", text: "What makes a society resilient?", theme: "abstract" },
    { id: "structure_051", text: "Why does luck favor the prepared more often than the lucky?", theme: "abstract" },
    { id: "structure_052", text: "What makes an idea spread?", theme: "abstract" },
    { id: "structure_053", text: "Why is regret a worse teacher than failure?", theme: "abstract" },
    { id: "structure_054", text: "What separates discipline from motivation?", theme: "abstract" },
    { id: "structure_055", text: "Why do good ideas sometimes take a decade to land?", theme: "abstract" },
    { id: "structure_056", text: "What makes feedback land harder when it's right?", theme: "abstract" },
    { id: "structure_057", text: "Why is honesty rarer than cleverness?", theme: "abstract" },
    { id: "structure_058", text: "What makes craft different from work?", theme: "abstract" },
    { id: "structure_059", text: "Why do we underrate boredom in creative work?", theme: "abstract" },
    { id: "structure_060", text: "What separates a good question from a bad one?", theme: "abstract" },
    { id: "structure_061", text: "Why does writing in public force clearer thinking?", theme: "work" },
    { id: "structure_062", text: "What makes a presentation actually move a decision?", theme: "work" },
    { id: "structure_063", text: "Why does meeting hygiene predict team output?", theme: "work" },
    { id: "structure_064", text: "What makes an internal memo worth reading?", theme: "work" },
    { id: "structure_065", text: "Why do top performers leave when the culture slips?", theme: "work" },
    { id: "structure_066", text: "Why is exercise non-negotiable past forty?", theme: "life" },
    { id: "structure_067", text: "What separates real listening from waiting to talk?", theme: "life" },
    { id: "structure_068", text: "Why do small annoyances signal bigger problems?", theme: "life" },
    { id: "structure_069", text: "What makes a long marriage actually work?", theme: "life" },
    { id: "structure_070", text: "Why is forgiveness more for you than for them?", theme: "life" },
    { id: "structure_071", text: "What makes some people age better than others?", theme: "life" },
    { id: "structure_072", text: "Why does generosity scale better than selfishness?", theme: "abstract" },
    { id: "structure_073", text: "What makes a city memorable?", theme: "abstract" },
    { id: "structure_074", text: "Why do some books survive a hundred years?", theme: "abstract" },
    { id: "structure_075", text: "What makes silence powerful in a conversation?", theme: "abstract" },
  ],
  think_fast: [
    { id: "think_fast_001", text: "Is technology making people more connected or less?", theme: "abstract" },
    { id: "think_fast_002", text: "Should people work from home or in an office?", theme: "work" },
    { id: "think_fast_003", text: "What is the most important skill to learn today?", theme: "life" },
    { id: "think_fast_004", text: "Is failure necessary for success?", theme: "abstract" },
    { id: "think_fast_005", text: "Are routines helpful or limiting?", theme: "life" },
    { id: "think_fast_006", text: "Should curiosity be taught, or is it innate?", theme: "abstract" },
    { id: "think_fast_007", text: "Is social media net positive or net negative?", theme: "abstract" },
    { id: "think_fast_008", text: "Should you trust your gut or the data?", theme: "abstract" },
    { id: "think_fast_009", text: "Is hard work overrated?", theme: "abstract" },
    { id: "think_fast_010", text: "Should schools prioritize creativity or discipline?", theme: "abstract" },
    { id: "think_fast_011", text: "Are meetings ever actually useful?", theme: "work" },
    { id: "think_fast_012", text: "Should you follow your passion or your strengths?", theme: "life" },
    { id: "think_fast_013", text: "Is optimism a choice or a trait?", theme: "abstract" },
    { id: "think_fast_014", text: "Should we automate everything we can?", theme: "abstract" },
    { id: "think_fast_015", text: "Is reading fiction a waste of time?", theme: "abstract" },
    { id: "think_fast_016", text: "Should companies be required to disclose AI use to customers?", theme: "abstract" },
    { id: "think_fast_017", text: "Is remote work better for productivity or for people?", theme: "work" },
    { id: "think_fast_018", text: "Should performance reviews exist?", theme: "work" },
    { id: "think_fast_019", text: "Is feedback more valuable from peers or from managers?", theme: "work" },
    { id: "think_fast_020", text: "Should every meeting have a written agenda?", theme: "work" },
    { id: "think_fast_021", text: "Is it better to ship fast and fix later or build slow and ship right?", theme: "work" },
    { id: "think_fast_022", text: "Should companies pay everyone the same?", theme: "work" },
    { id: "think_fast_023", text: "Is unlimited PTO actually a benefit?", theme: "work" },
    { id: "think_fast_024", text: "Should you stay loyal to a company that's loyal to you?", theme: "work" },
    { id: "think_fast_025", text: "Is the best leader the one nobody talks about?", theme: "work" },
    { id: "think_fast_026", text: "Should you take the promotion or the lateral move?", theme: "work" },
    { id: "think_fast_027", text: "Is title or scope more important early in a career?", theme: "work" },
    { id: "think_fast_028", text: "Should companies fire fast?", theme: "work" },
    { id: "think_fast_029", text: "Is networking a skill or a personality trait?", theme: "work" },
    { id: "think_fast_030", text: "Should you ever take a pay cut for a better company?", theme: "work" },
    { id: "think_fast_031", text: "Is it better to live in a big city or a small one?", theme: "life" },
    { id: "think_fast_032", text: "Should kids get phones before high school?", theme: "life" },
    { id: "think_fast_033", text: "Is marriage still worth it?", theme: "life" },
    { id: "think_fast_034", text: "Should you tell a friend their partner is wrong for them?", theme: "life" },
    { id: "think_fast_035", text: "Is it better to retire early or work as long as you can?", theme: "life" },
    { id: "think_fast_036", text: "Should you keep friendships that drain you?", theme: "life" },
    { id: "think_fast_037", text: "Is it better to live near family or near opportunity?", theme: "life" },
    { id: "think_fast_038", text: "Should you spend on experiences or save for the future?", theme: "life" },
    { id: "think_fast_039", text: "Is it better to date intentionally or let things happen?", theme: "life" },
    { id: "think_fast_040", text: "Should you tell people what you really think of them?", theme: "life" },
    { id: "think_fast_041", text: "Is exercise more about the body or the mind?", theme: "life" },
    { id: "think_fast_042", text: "Should you read more or write more?", theme: "life" },
    { id: "think_fast_043", text: "Is it better to plan your week or stay flexible?", theme: "life" },
    { id: "think_fast_044", text: "Should you have hobbies outside your career?", theme: "life" },
    { id: "think_fast_045", text: "Is solitude more valuable than community?", theme: "life" },
    { id: "think_fast_046", text: "Is the meaning of life found or built?", theme: "abstract" },
    { id: "think_fast_047", text: "Should governments regulate AI?", theme: "abstract" },
    { id: "think_fast_048", text: "Is privacy a right or a luxury?", theme: "abstract" },
    { id: "think_fast_049", text: "Should education be free?", theme: "abstract" },
    { id: "think_fast_050", text: "Is wealth a measure of success?", theme: "abstract" },
    { id: "think_fast_051", text: "Should we colonize Mars?", theme: "abstract" },
    { id: "think_fast_052", text: "Is patriotism a virtue or a trap?", theme: "abstract" },
    { id: "think_fast_053", text: "Should art be judged on craft or on impact?", theme: "abstract" },
    { id: "think_fast_054", text: "Is voting a duty or a choice?", theme: "abstract" },
    { id: "think_fast_055", text: "Should there be a maximum wage?", theme: "abstract" },
    { id: "think_fast_056", text: "Is consciousness solvable?", theme: "abstract" },
    { id: "think_fast_057", text: "Should jobs that AI does get taxed?", theme: "abstract" },
    { id: "think_fast_058", text: "Is happiness the right goal?", theme: "abstract" },
    { id: "think_fast_059", text: "Should historical figures be judged by today's standards?", theme: "abstract" },
    { id: "think_fast_060", text: "Is free will an illusion?", theme: "abstract" },
    { id: "think_fast_061", text: "Should companies invest in their lowest performers?", theme: "work" },
    { id: "think_fast_062", text: "Is it ever right to break a contract?", theme: "work" },
    { id: "think_fast_063", text: "Should bosses know what their reports earn?", theme: "work" },
    { id: "think_fast_064", text: "Is loyalty in business a feature or a bug?", theme: "work" },
    { id: "think_fast_065", text: "Should email be banned after 6pm?", theme: "work" },
    { id: "think_fast_066", text: "Is it better to live with regret or with what-ifs?", theme: "life" },
    { id: "think_fast_067", text: "Should you give up something you're good at to try something new?", theme: "life" },
    { id: "think_fast_068", text: "Is it worse to be lonely or to be misunderstood?", theme: "life" },
    { id: "think_fast_069", text: "Should you confront the friend who hurt you or move on?", theme: "life" },
    { id: "think_fast_070", text: "Is it better to know your future or be surprised by it?", theme: "life" },
    { id: "think_fast_071", text: "Is the internet making us smarter or more confident?", theme: "abstract" },
    { id: "think_fast_072", text: "Should creativity be measured?", theme: "abstract" },
    { id: "think_fast_073", text: "Is humility underrated as a leadership trait?", theme: "abstract" },
    { id: "think_fast_074", text: "Should you trust someone who never changes their mind?", theme: "abstract" },
    { id: "think_fast_075", text: "Is the truth always worth telling?", theme: "abstract" },
  ],
  be_concise: [
    { id: "be_concise_001", text: "Explain how investing works in 20 seconds", theme: "life" },
    { id: "be_concise_002", text: "Explain how habits are formed in 20 seconds", theme: "life" },
    { id: "be_concise_003", text: "Explain why exercise is important in 15 seconds", theme: "life" },
    { id: "be_concise_004", text: "Explain how the internet works in 20 seconds", theme: "abstract" },
    { id: "be_concise_005", text: "Explain how sleep impacts your health in 20 seconds", theme: "life" },
    { id: "be_concise_006", text: "Explain what leadership means in 15 seconds", theme: "work" },
    { id: "be_concise_007", text: "Explain why time management matters in 20 seconds", theme: "life" },
    { id: "be_concise_008", text: "Explain how decisions get made in 20 seconds", theme: "abstract" },
    { id: "be_concise_009", text: "Explain what makes feedback useful in 15 seconds", theme: "work" },
    { id: "be_concise_010", text: "Explain why consistency beats intensity in 20 seconds", theme: "life" },
    { id: "be_concise_011", text: "Explain how to learn a new skill in 20 seconds", theme: "life" },
    { id: "be_concise_012", text: "Explain what makes a team work in 15 seconds", theme: "work" },
    { id: "be_concise_013", text: "Explain why clarity matters in 15 seconds", theme: "abstract" },
    { id: "be_concise_014", text: "Explain what curiosity does in 20 seconds", theme: "abstract" },
    { id: "be_concise_015", text: "Explain how focus works in 20 seconds", theme: "life" },
    { id: "be_concise_016", text: "Sum up your job in 15 seconds", theme: "work" },
    { id: "be_concise_017", text: "Explain why a 1:1 matters in 15 seconds", theme: "work" },
    { id: "be_concise_018", text: "Pitch your team's project in 20 seconds", theme: "work" },
    { id: "be_concise_019", text: "Explain why your team needs more headcount in 15 seconds", theme: "work" },
    { id: "be_concise_020", text: "Defend your roadmap in 20 seconds", theme: "work" },
    { id: "be_concise_021", text: "Recap last quarter in 20 seconds", theme: "work" },
    { id: "be_concise_022", text: "Explain why a process needs changing in 15 seconds", theme: "work" },
    { id: "be_concise_023", text: "Sell the value of a customer call in 15 seconds", theme: "work" },
    { id: "be_concise_024", text: "Explain why your team should keep retros in 20 seconds", theme: "work" },
    { id: "be_concise_025", text: "Explain why deadlines move people in 15 seconds", theme: "work" },
    { id: "be_concise_026", text: "Argue for ten hours of focus time in 15 seconds", theme: "work" },
    { id: "be_concise_027", text: "Defend your tool choice in 20 seconds", theme: "work" },
    { id: "be_concise_028", text: "Explain why writing matters more than meetings in 15 seconds", theme: "work" },
    { id: "be_concise_029", text: "Pitch why your role exists in 20 seconds", theme: "work" },
    { id: "be_concise_030", text: "Explain why the team should ship in 20 seconds", theme: "work" },
    { id: "be_concise_031", text: "Tell a friend why they should travel solo in 15 seconds", theme: "life" },
    { id: "be_concise_032", text: "Explain why morning sun matters in 15 seconds", theme: "life" },
    { id: "be_concise_033", text: "Convince yourself to log off in 15 seconds", theme: "life" },
    { id: "be_concise_034", text: "Explain why cooking at home wins in 15 seconds", theme: "life" },
    { id: "be_concise_035", text: "Defend your weekend ritual in 20 seconds", theme: "life" },
    { id: "be_concise_036", text: "Pitch a hobby to a skeptical partner in 20 seconds", theme: "life" },
    { id: "be_concise_037", text: "Explain why journaling helps in 15 seconds", theme: "life" },
    { id: "be_concise_038", text: "Sell the value of a long walk in 15 seconds", theme: "life" },
    { id: "be_concise_039", text: "Convince yourself to go to bed in 15 seconds", theme: "life" },
    { id: "be_concise_040", text: "Explain why running matters in 15 seconds", theme: "life" },
    { id: "be_concise_041", text: "Pitch a new habit to your past self in 20 seconds", theme: "life" },
    { id: "be_concise_042", text: "Convince a friend to read a specific book in 20 seconds", theme: "life" },
    { id: "be_concise_043", text: "Explain why protein matters in 15 seconds", theme: "life" },
    { id: "be_concise_044", text: "Defend your morning routine in 20 seconds", theme: "life" },
    { id: "be_concise_045", text: "Sell sobriety in 20 seconds", theme: "life" },
    { id: "be_concise_046", text: "Explain why curiosity scales in 15 seconds", theme: "abstract" },
    { id: "be_concise_047", text: "Argue against multitasking in 15 seconds", theme: "abstract" },
    { id: "be_concise_048", text: "Defend silence as a habit in 20 seconds", theme: "abstract" },
    { id: "be_concise_049", text: "Explain why systems beat goals in 20 seconds", theme: "abstract" },
    { id: "be_concise_050", text: "Pitch the value of a deadline in 15 seconds", theme: "abstract" },
    { id: "be_concise_051", text: "Argue for less choice in 20 seconds", theme: "abstract" },
    { id: "be_concise_052", text: "Explain why momentum matters more than motivation in 15 seconds", theme: "abstract" },
    { id: "be_concise_053", text: "Defend slow decisions in 20 seconds", theme: "abstract" },
    { id: "be_concise_054", text: "Explain why hard things compound in 15 seconds", theme: "abstract" },
    { id: "be_concise_055", text: "Argue that constraints help creativity in 20 seconds", theme: "abstract" },
    { id: "be_concise_056", text: "Pitch the discipline of saying no in 15 seconds", theme: "abstract" },
    { id: "be_concise_057", text: "Explain why writing clarifies thinking in 15 seconds", theme: "abstract" },
    { id: "be_concise_058", text: "Defend doing one thing at a time in 20 seconds", theme: "abstract" },
    { id: "be_concise_059", text: "Argue that less is more in 15 seconds", theme: "abstract" },
    { id: "be_concise_060", text: "Explain why repetition beats novelty in 20 seconds", theme: "abstract" },
    { id: "be_concise_061", text: "Pitch your team's biggest win this quarter in 20 seconds", theme: "work" },
    { id: "be_concise_062", text: "Tell a customer the upgrade is worth it in 20 seconds", theme: "work" },
    { id: "be_concise_063", text: "Sell the next sprint's priority in 20 seconds", theme: "work" },
    { id: "be_concise_064", text: "Explain why a meeting can be killed in 15 seconds", theme: "work" },
    { id: "be_concise_065", text: "Pitch a junior teammate's contribution in 20 seconds", theme: "work" },
    { id: "be_concise_066", text: "Explain why morning workouts stick in 15 seconds", theme: "life" },
    { id: "be_concise_067", text: "Defend short workouts in 15 seconds", theme: "life" },
    { id: "be_concise_068", text: "Convince a friend to say no more often in 20 seconds", theme: "life" },
    { id: "be_concise_069", text: "Pitch starting a savings habit in 20 seconds", theme: "life" },
    { id: "be_concise_070", text: "Sell making your bed every morning in 15 seconds", theme: "life" },
    { id: "be_concise_071", text: "Argue that less news is better in 20 seconds", theme: "abstract" },
    { id: "be_concise_072", text: "Defend boredom as a creative tool in 15 seconds", theme: "abstract" },
    { id: "be_concise_073", text: "Explain why first drafts beat outlines in 20 seconds", theme: "abstract" },
    { id: "be_concise_074", text: "Pitch the power of one habit in 15 seconds", theme: "abstract" },
    { id: "be_concise_075", text: "Defend honesty even when it's costly in 20 seconds", theme: "abstract" },
  ],
  reinforce: [
    { id: "reinforce_001", text: "Explain how to build a good habit", theme: "life" },
    { id: "reinforce_002", text: "Explain how to stay organized", theme: "life" },
    { id: "reinforce_003", text: "Explain how to cook a simple meal", theme: "life" },
    { id: "reinforce_004", text: "Explain how to improve focus", theme: "life" },
    { id: "reinforce_005", text: "Explain how to manage your time", theme: "life" },
    { id: "reinforce_006", text: "Explain how to give clear instructions", theme: "work" },
    { id: "reinforce_007", text: "Explain how to apologize effectively", theme: "life" },
    { id: "reinforce_008", text: "Explain how to say no politely", theme: "life" },
    { id: "reinforce_009", text: "Explain how to take useful notes", theme: "life" },
    { id: "reinforce_010", text: "Explain how to make a decision under uncertainty", theme: "abstract" },
    { id: "reinforce_011", text: "Explain how to break a bad habit", theme: "life" },
    { id: "reinforce_012", text: "Explain how to ask a good question", theme: "abstract" },
    { id: "reinforce_013", text: "Explain how to remember names", theme: "life" },
    { id: "reinforce_014", text: "Explain how to get better at listening", theme: "life" },
    { id: "reinforce_015", text: "Explain how to recover from a mistake", theme: "life" },
    { id: "reinforce_016", text: "Explain how to read a book and remember what's in it", theme: "life" },
    { id: "reinforce_017", text: "Explain how to budget for the first time", theme: "life" },
    { id: "reinforce_018", text: "Explain how to run a 5K from couch zero", theme: "life" },
    { id: "reinforce_019", text: "Explain how to negotiate rent without alienating your landlord", theme: "life" },
    { id: "reinforce_020", text: "Explain how to plan a week so things actually get done", theme: "life" },
    { id: "reinforce_021", text: "Explain how to cook eggs three different ways", theme: "life" },
    { id: "reinforce_022", text: "Explain how to start saving with a small paycheck", theme: "life" },
    { id: "reinforce_023", text: "Explain how to stop checking your phone first thing in the morning", theme: "life" },
    { id: "reinforce_024", text: "Explain how to repair a friendship after a fight", theme: "life" },
    { id: "reinforce_025", text: "Explain how to handle a difficult conversation with a parent", theme: "life" },
    { id: "reinforce_026", text: "Explain how to deal with anxiety in the moment", theme: "life" },
    { id: "reinforce_027", text: "Explain how to do a perfect pushup", theme: "life" },
    { id: "reinforce_028", text: "Explain how to wake up earlier without hating it", theme: "life" },
    { id: "reinforce_029", text: "Explain how to choose a good therapist", theme: "life" },
    { id: "reinforce_030", text: "Explain how to break up with someone kindly", theme: "life" },
    { id: "reinforce_031", text: "Explain how to write a useful daily note", theme: "life" },
    { id: "reinforce_032", text: "Explain how to talk to someone going through a tough time", theme: "life" },
    { id: "reinforce_033", text: "Explain how to keep a streak going past three weeks", theme: "life" },
    { id: "reinforce_034", text: "Explain how to pack a carry-on for a week", theme: "life" },
    { id: "reinforce_035", text: "Explain how to fall asleep faster", theme: "life" },
    { id: "reinforce_036", text: "Explain how to start meditating without the woo", theme: "life" },
    { id: "reinforce_037", text: "Explain how to ask for a raise the right way", theme: "work" },
    { id: "reinforce_038", text: "Explain how to give a junior teammate useful feedback", theme: "work" },
    { id: "reinforce_039", text: "Explain how to run a productive 1:1", theme: "work" },
    { id: "reinforce_040", text: "Explain how to write an email people actually read", theme: "work" },
    { id: "reinforce_041", text: "Explain how to onboard a new hire in their first week", theme: "work" },
    { id: "reinforce_042", text: "Explain how to lead a meeting that ends with a decision", theme: "work" },
    { id: "reinforce_043", text: "Explain how to handle a customer escalation", theme: "work" },
    { id: "reinforce_044", text: "Explain how to give a manager critical feedback", theme: "work" },
    { id: "reinforce_045", text: "Explain how to plan a sprint that hits", theme: "work" },
    { id: "reinforce_046", text: "Explain how to scope a project realistically", theme: "work" },
    { id: "reinforce_047", text: "Explain how to write a status update that builds trust", theme: "work" },
    { id: "reinforce_048", text: "Explain how to disagree without burning the relationship", theme: "work" },
    { id: "reinforce_049", text: "Explain how to leave a job gracefully", theme: "work" },
    { id: "reinforce_050", text: "Explain how to interview for a senior role", theme: "work" },
    { id: "reinforce_051", text: "Explain how to deliver bad news to a customer", theme: "work" },
    { id: "reinforce_052", text: "Explain how to handle a teammate who's underperforming", theme: "work" },
    { id: "reinforce_053", text: "Explain how to write a doc that decides something", theme: "work" },
    { id: "reinforce_054", text: "Explain how to navigate a politically loaded meeting", theme: "work" },
    { id: "reinforce_055", text: "Explain how to make a hard call as a new manager", theme: "work" },
    { id: "reinforce_056", text: "Explain how to learn a new skill faster than the average", theme: "abstract" },
    { id: "reinforce_057", text: "Explain how to spot a bad argument", theme: "abstract" },
    { id: "reinforce_058", text: "Explain how to read critically", theme: "abstract" },
    { id: "reinforce_059", text: "Explain how to make a decision when both options look equal", theme: "abstract" },
    { id: "reinforce_060", text: "Explain how to take useful notes from a long meeting", theme: "abstract" },
    { id: "reinforce_061", text: "Explain how to set up a weekly review", theme: "life" },
    { id: "reinforce_062", text: "Explain how to give a wedding toast that lands", theme: "life" },
    { id: "reinforce_063", text: "Explain how to build a habit that survives travel", theme: "life" },
    { id: "reinforce_064", text: "Explain how to choose an exercise plan you'll actually do", theme: "life" },
    { id: "reinforce_065", text: "Explain how to teach a kid to ride a bike", theme: "life" },
    { id: "reinforce_066", text: "Explain how to run a productive retro", theme: "work" },
    { id: "reinforce_067", text: "Explain how to handle a missed deadline with a customer", theme: "work" },
    { id: "reinforce_068", text: "Explain how to write a one-page plan", theme: "work" },
    { id: "reinforce_069", text: "Explain how to host a debug session that teaches the team", theme: "work" },
    { id: "reinforce_070", text: "Explain how to pitch an idea your boss will hate at first", theme: "work" },
    { id: "reinforce_071", text: "Explain how to evaluate a job offer", theme: "abstract" },
    { id: "reinforce_072", text: "Explain how to read a research paper without drowning", theme: "abstract" },
    { id: "reinforce_073", text: "Explain how to evaluate advice", theme: "abstract" },
    { id: "reinforce_074", text: "Explain how to build a reading habit", theme: "abstract" },
    { id: "reinforce_075", text: "Explain how to write a book review that's worth reading", theme: "abstract" },
  ],
  persuade: [
    { id: "persuade_001", text: "Convince someone to exercise regularly", theme: "life" },
    { id: "persuade_002", text: "Convince someone to read more", theme: "life" },
    { id: "persuade_003", text: "Convince someone to wake up earlier", theme: "life" },
    { id: "persuade_004", text: "Convince someone to save money", theme: "life" },
    { id: "persuade_005", text: "Convince someone to learn a new skill", theme: "life" },
    { id: "persuade_006", text: "Convince someone to prioritize sleep", theme: "life" },
    { id: "persuade_007", text: "Convince someone to take a calculated risk", theme: "abstract" },
    { id: "persuade_008", text: "Convince someone to try meditation", theme: "life" },
    { id: "persuade_009", text: "Convince someone to spend less time on social media", theme: "life" },
    { id: "persuade_010", text: "Convince someone to ask for a raise", theme: "work" },
    { id: "persuade_011", text: "Convince someone to write more clearly", theme: "abstract" },
    { id: "persuade_012", text: "Convince someone to take a vacation", theme: "life" },
    { id: "persuade_013", text: "Convince someone to start a side project", theme: "life" },
    { id: "persuade_014", text: "Convince someone to speak up more in meetings", theme: "work" },
    { id: "persuade_015", text: "Convince someone to stop multitasking", theme: "life" },
    { id: "persuade_016", text: "Convince a friend to delete a social app for a month", theme: "life" },
    { id: "persuade_017", text: "Convince your partner to try a new restaurant they're skeptical about", theme: "life" },
    { id: "persuade_018", text: "Convince a parent to take a vacation alone", theme: "life" },
    { id: "persuade_019", text: "Convince someone to start therapy", theme: "life" },
    { id: "persuade_020", text: "Convince a friend to forgive someone who wronged them", theme: "life" },
    { id: "persuade_021", text: "Convince a friend to leave a job they've outgrown", theme: "life" },
    { id: "persuade_022", text: "Convince yourself to do the thing you've been avoiding", theme: "life" },
    { id: "persuade_023", text: "Convince a sibling to move closer to family", theme: "life" },
    { id: "persuade_024", text: "Convince a friend to apologize first", theme: "life" },
    { id: "persuade_025", text: "Convince someone to stop comparing themselves to others online", theme: "life" },
    { id: "persuade_026", text: "Convince a roommate to clean the kitchen consistently", theme: "life" },
    { id: "persuade_027", text: "Convince a friend to try cold-water swimming", theme: "life" },
    { id: "persuade_028", text: "Convince a parent to learn one piece of new technology", theme: "life" },
    { id: "persuade_029", text: "Convince yourself to take that trip you keep postponing", theme: "life" },
    { id: "persuade_030", text: "Convince a friend who hates running to try it for two weeks", theme: "life" },
    { id: "persuade_031", text: "Convince your manager to let you work from a different city for a month", theme: "work" },
    { id: "persuade_032", text: "Convince a teammate to take a sabbatical", theme: "work" },
    { id: "persuade_033", text: "Convince your team to kill a project that isn't working", theme: "work" },
    { id: "persuade_034", text: "Convince leadership to invest in tooling instead of headcount", theme: "work" },
    { id: "persuade_035", text: "Convince a peer that your team's metric is the right one", theme: "work" },
    { id: "persuade_036", text: "Convince your CEO that documentation is worth a sprint", theme: "work" },
    { id: "persuade_037", text: "Convince a customer to renew a contract they're hesitant about", theme: "work" },
    { id: "persuade_038", text: "Convince a recruiter to fast-track your candidate", theme: "work" },
    { id: "persuade_039", text: "Convince a colleague to take credit they're shy about", theme: "work" },
    { id: "persuade_040", text: "Convince your team to adopt a new tool", theme: "work" },
    { id: "persuade_041", text: "Convince a manager to hire someone unconventional", theme: "work" },
    { id: "persuade_042", text: "Convince a senior leader to attend the next all-hands", theme: "work" },
    { id: "persuade_043", text: "Convince your team to merge faster", theme: "work" },
    { id: "persuade_044", text: "Convince a board member to take a meeting with a customer", theme: "work" },
    { id: "persuade_045", text: "Convince leadership to scrap a vanity metric", theme: "work" },
    { id: "persuade_046", text: "Convince a skeptic that AI is a tool, not a threat", theme: "abstract" },
    { id: "persuade_047", text: "Convince an audience that constraints help creativity", theme: "abstract" },
    { id: "persuade_048", text: "Convince a doubter that consistency beats brilliance", theme: "abstract" },
    { id: "persuade_049", text: "Convince a friend that boredom is good for them", theme: "abstract" },
    { id: "persuade_050", text: "Convince a peer that simplicity is harder than complexity", theme: "abstract" },
    { id: "persuade_051", text: "Convince an audience that small daily actions compound", theme: "abstract" },
    { id: "persuade_052", text: "Convince a skeptic that long-form reading still matters", theme: "abstract" },
    { id: "persuade_053", text: "Convince someone that public failure is survivable", theme: "abstract" },
    { id: "persuade_054", text: "Convince a doubter that listening is undervalued", theme: "abstract" },
    { id: "persuade_055", text: "Convince an audience that craft matters even when nobody notices", theme: "abstract" },
    { id: "persuade_056", text: "Convince a friend to try a strict no-phone hour each day", theme: "life" },
    { id: "persuade_057", text: "Convince yourself to call your grandparents weekly", theme: "life" },
    { id: "persuade_058", text: "Convince a partner to plan a weekend with no agenda", theme: "life" },
    { id: "persuade_059", text: "Convince a friend to start running 5K once a week", theme: "life" },
    { id: "persuade_060", text: "Convince a friend that volunteering changes them", theme: "life" },
    { id: "persuade_061", text: "Convince your team to stop checking Slack on weekends", theme: "work" },
    { id: "persuade_062", text: "Convince leadership that career laddering is broken", theme: "work" },
    { id: "persuade_063", text: "Convince a peer to mentor someone outside their team", theme: "work" },
    { id: "persuade_064", text: "Convince a manager to give a struggling teammate a stretch project", theme: "work" },
    { id: "persuade_065", text: "Convince a customer that a slower rollout is safer", theme: "work" },
    { id: "persuade_066", text: "Convince a colleague to change their meeting habits", theme: "work" },
    { id: "persuade_067", text: "Convince leadership that a layoff was the wrong call", theme: "work" },
    { id: "persuade_068", text: "Convince an exec to take a meeting with an unhappy customer", theme: "work" },
    { id: "persuade_069", text: "Convince a peer that their idea is bigger than they think", theme: "work" },
    { id: "persuade_070", text: "Convince a teammate to push back on a bad spec", theme: "work" },
    { id: "persuade_071", text: "Convince an audience that good ideas come from constraints", theme: "abstract" },
    { id: "persuade_072", text: "Convince a friend that thinking out loud is a skill", theme: "abstract" },
    { id: "persuade_073", text: "Convince yourself that rest is a tool, not a reward", theme: "abstract" },
    { id: "persuade_074", text: "Convince a doubter that being wrong is the fastest way to learn", theme: "abstract" },
    { id: "persuade_075", text: "Convince a skeptic that small acts of generosity scale", theme: "abstract" },
  ],
  adapt: [
    { id: "adapt_001", text: "Explain how money works to a child, then to an adult", theme: "life" },
    { id: "adapt_002", text: "Explain exercise to a beginner, then to an athlete", theme: "life" },
    { id: "adapt_003", text: "Explain the internet to a senior, then to a teenager", theme: "life" },
    { id: "adapt_004", text: "Explain teamwork to a student, then to a manager", theme: "work" },
    { id: "adapt_005", text: "Explain healthy eating to a child, then to a parent", theme: "life" },
    { id: "adapt_006", text: "Explain coding to a non-technical friend, then to a colleague", theme: "work" },
    { id: "adapt_007", text: "Explain leadership to an intern, then to a CEO", theme: "work" },
    { id: "adapt_008", text: "Explain AI to a skeptic, then to an enthusiast", theme: "abstract" },
    { id: "adapt_009", text: "Explain budgeting to a student, then to a retiree", theme: "life" },
    { id: "adapt_010", text: "Explain storytelling to a writer, then to an engineer", theme: "work" },
    { id: "adapt_011", text: "Explain failure to a perfectionist, then to a risk-taker", theme: "abstract" },
    { id: "adapt_012", text: "Explain focus to a procrastinator, then to a workaholic", theme: "life" },
    { id: "adapt_013", text: "Explain feedback to a junior employee, then to a VP", theme: "work" },
    { id: "adapt_014", text: "Explain habits to a child, then to a busy professional", theme: "life" },
    { id: "adapt_015", text: "Explain change to someone who fears it, then to someone who craves it", theme: "abstract" },
    { id: "adapt_016", text: "Explain a software bug to a designer, then to an engineer", theme: "work" },
    { id: "adapt_017", text: "Explain a business strategy to a board, then to your team", theme: "work" },
    { id: "adapt_018", text: "Explain a missed deadline to a customer, then to your manager", theme: "work" },
    { id: "adapt_019", text: "Explain a layoff to the team, then to one of the people leaving", theme: "work" },
    { id: "adapt_020", text: "Explain a complex contract to a client CFO, then to your engineering lead", theme: "work" },
    { id: "adapt_021", text: "Explain a price increase to a customer, then to your sales team", theme: "work" },
    { id: "adapt_022", text: "Explain why a feature is delayed to a user, then to your CEO", theme: "work" },
    { id: "adapt_023", text: "Explain a security incident to a customer, then to your board", theme: "work" },
    { id: "adapt_024", text: "Explain a hiring decision to the candidate, then to the hiring panel", theme: "work" },
    { id: "adapt_025", text: "Explain a pivot to a junior teammate, then to an investor", theme: "work" },
    { id: "adapt_026", text: "Explain a code change to a non-technical PM, then to your tech lead", theme: "work" },
    { id: "adapt_027", text: "Explain a client problem to your associate, then to the partner", theme: "work" },
    { id: "adapt_028", text: "Explain an outage to customers, then to engineering", theme: "work" },
    { id: "adapt_029", text: "Explain a roadmap shift to your team, then to leadership", theme: "work" },
    { id: "adapt_030", text: "Explain why metrics changed to your CEO, then to your team", theme: "work" },
    { id: "adapt_031", text: "Explain why you chose this job to a friend, then to a recruiter", theme: "life" },
    { id: "adapt_032", text: "Explain why you broke up to your best friend, then to your mom", theme: "life" },
    { id: "adapt_033", text: "Explain a gap year to a parent, then to a hiring manager", theme: "life" },
    { id: "adapt_034", text: "Explain therapy to a curious friend, then to a skeptical parent", theme: "life" },
    { id: "adapt_035", text: "Explain a diagnosis to your kids, then to your boss", theme: "life" },
    { id: "adapt_036", text: "Explain a financial decision to your partner, then to your accountant", theme: "life" },
    { id: "adapt_037", text: "Explain why you quit drinking to a friend, then to a date", theme: "life" },
    { id: "adapt_038", text: "Explain a religious choice to a parent, then to a partner", theme: "life" },
    { id: "adapt_039", text: "Explain a hobby to a peer, then to your grandparents", theme: "life" },
    { id: "adapt_040", text: "Explain why you moved cities to a friend, then to a stranger", theme: "life" },
    { id: "adapt_041", text: "Explain a marathon goal to your kids, then to your coach", theme: "life" },
    { id: "adapt_042", text: "Explain a budget cut at home to a teenager, then to your spouse", theme: "life" },
    { id: "adapt_043", text: "Explain why you're going back to school to a friend, then to your boss", theme: "life" },
    { id: "adapt_044", text: "Explain a new diet to a foodie friend, then to your doctor", theme: "life" },
    { id: "adapt_045", text: "Explain a difficult parenting decision to your child, then to your in-laws", theme: "life" },
    { id: "adapt_046", text: "Explain compound interest to a college student, then to a financial advisor", theme: "abstract" },
    { id: "adapt_047", text: "Explain creativity to an engineer, then to a poet", theme: "abstract" },
    { id: "adapt_048", text: "Explain free will to a determinist, then to a believer", theme: "abstract" },
    { id: "adapt_049", text: "Explain morality to a child, then to a philosopher", theme: "abstract" },
    { id: "adapt_050", text: "Explain meditation to a skeptic, then to a long-time practitioner", theme: "abstract" },
    { id: "adapt_051", text: "Explain a conspiracy theory's appeal to a believer, then to a journalist", theme: "abstract" },
    { id: "adapt_052", text: "Explain climate change to a doubter, then to a policymaker", theme: "abstract" },
    { id: "adapt_053", text: "Explain quantum computing to a high-schooler, then to an investor", theme: "abstract" },
    { id: "adapt_054", text: "Explain art to an accountant, then to a critic", theme: "abstract" },
    { id: "adapt_055", text: "Explain spirituality to an atheist, then to a believer", theme: "abstract" },
    { id: "adapt_056", text: "Explain risk to a child, then to an entrepreneur", theme: "abstract" },
    { id: "adapt_057", text: "Explain justice to a child, then to a lawyer", theme: "abstract" },
    { id: "adapt_058", text: "Explain success to a teenager, then to a retiree", theme: "abstract" },
    { id: "adapt_059", text: "Explain love to a five-year-old, then to a marriage counselor", theme: "abstract" },
    { id: "adapt_060", text: "Explain ambition to a contented person, then to a striver", theme: "abstract" },
    { id: "adapt_061", text: "Explain why you're buying a house to a friend, then to your loan officer", theme: "life" },
    { id: "adapt_062", text: "Explain a medical condition to your kid, then to your insurance rep", theme: "life" },
    { id: "adapt_063", text: "Explain why you canceled the trip to your kids, then to your travel agent", theme: "life" },
    { id: "adapt_064", text: "Explain why you're switching schools to your kid, then to the new principal", theme: "life" },
    { id: "adapt_065", text: "Explain a family heirloom to a child, then to an appraiser", theme: "life" },
    { id: "adapt_066", text: "Explain a database migration to a non-technical exec, then to your team", theme: "work" },
    { id: "adapt_067", text: "Explain a pricing change to a customer, then to your CFO", theme: "work" },
    { id: "adapt_068", text: "Explain a difficult firing to the team, then to HR", theme: "work" },
    { id: "adapt_069", text: "Explain a strategic bet to your team, then to the board", theme: "work" },
    { id: "adapt_070", text: "Explain a customer story to engineering, then to design", theme: "work" },
    { id: "adapt_071", text: "Explain trust to a child, then to a CEO", theme: "abstract" },
    { id: "adapt_072", text: "Explain growth to a teenager, then to a coach", theme: "abstract" },
    { id: "adapt_073", text: "Explain failure to a perfectionist, then to a beginner", theme: "abstract" },
    { id: "adapt_074", text: "Explain identity to a child, then to a philosopher", theme: "abstract" },
    { id: "adapt_075", text: "Explain hope to a cynic, then to an optimist", theme: "abstract" },
  ],
  deliver: [
    { id: "deliver_001", text: "Explain why communication matters — pause between ideas for emphasis", theme: "abstract" },
    { id: "deliver_002", text: "Explain how habits are formed — slow and deliberate", theme: "life" },
    { id: "deliver_003", text: "Describe your daily routine with clear pauses", theme: "life" },
    { id: "deliver_004", text: "Explain why sleep is important with controlled pacing", theme: "life" },
    { id: "deliver_005", text: "Explain a topic while emphasizing key ideas through tempo", theme: "abstract" },
    { id: "deliver_006", text: "Share a lesson you learned — let the important beats breathe", theme: "life" },
    { id: "deliver_007", text: "Explain a decision — use silence to signal weight", theme: "abstract" },
    { id: "deliver_008", text: "Describe a place that mattered to you — pace it like a story", theme: "life" },
    { id: "deliver_009", text: "Explain a concept with three deliberate peaks", theme: "abstract" },
    { id: "deliver_010", text: "Share an opinion with controlled cadence", theme: "abstract" },
    { id: "deliver_011", text: "Explain a memory — slow for emphasis, speed for action", theme: "life" },
    { id: "deliver_012", text: "Give advice with pauses after each point", theme: "abstract" },
    { id: "deliver_013", text: "Describe something you love — let rhythm carry the warmth", theme: "life" },
    { id: "deliver_014", text: "Explain a rule you live by — deliberate and unhurried", theme: "life" },
    { id: "deliver_015", text: "Describe a turning point — use tempo to mark the shift", theme: "life" },
    { id: "deliver_016", text: "Tell the story of your first job — slow at the open, faster through the chaos", theme: "life" },
    { id: "deliver_017", text: "Describe the first time you got fired or quit — let the silence land", theme: "life" },
    { id: "deliver_018", text: "Tell about the night you knew a relationship was ending — pace the realization", theme: "life" },
    { id: "deliver_019", text: "Recount a moment you were proud of — slow at the win", theme: "life" },
    { id: "deliver_020", text: "Describe a memory of your grandmother — let the warmth breathe", theme: "life" },
    { id: "deliver_021", text: "Talk about a time you almost gave up — pause before the turn", theme: "life" },
    { id: "deliver_022", text: "Describe a place that's no longer there — let the absence sit", theme: "life" },
    { id: "deliver_023", text: "Recount the moment you held your first child — slow it all the way down", theme: "life" },
    { id: "deliver_024", text: "Tell about a goodbye that mattered — three deliberate beats", theme: "life" },
    { id: "deliver_025", text: "Describe the smell of a place from your childhood — let the listener arrive", theme: "life" },
    { id: "deliver_026", text: "Recount an argument you regret — pace the apology", theme: "life" },
    { id: "deliver_027", text: "Talk about your favorite teacher — slow on what they said", theme: "life" },
    { id: "deliver_028", text: "Describe a fear you finally faced — pace the fear, not the win", theme: "life" },
    { id: "deliver_029", text: "Tell about a friend who saved you — let one specific thing land", theme: "life" },
    { id: "deliver_030", text: "Describe walking into your first apartment — let the quiet do the work", theme: "life" },
    { id: "deliver_031", text: "Tell the story of a deal you almost lost — slow at the pivot", theme: "work" },
    { id: "deliver_032", text: "Recount a presentation that went wrong — pause where it broke", theme: "work" },
    { id: "deliver_033", text: "Describe a hire who changed your team — slow at the moment you knew", theme: "work" },
    { id: "deliver_034", text: "Tell about a meeting that turned a career — beat the room", theme: "work" },
    { id: "deliver_035", text: "Recount the worst feedback you ever received — let the verdict sit", theme: "work" },
    { id: "deliver_036", text: "Describe a project that nearly killed your team — pace the recovery", theme: "work" },
    { id: "deliver_037", text: "Tell about the customer call that changed your strategy — slow on the line", theme: "work" },
    { id: "deliver_038", text: "Recount a launch night — let the calm before the chaos breathe", theme: "work" },
    { id: "deliver_039", text: "Describe walking into the office the day of a layoff — pace the silence", theme: "work" },
    { id: "deliver_040", text: "Tell about a boss who saw something in you — slow on what they said", theme: "work" },
    { id: "deliver_041", text: "Recount a deal you closed that nobody believed in — let the doubt land", theme: "work" },
    { id: "deliver_042", text: "Describe the night before a launch — let the anticipation build", theme: "work" },
    { id: "deliver_043", text: "Tell about the day you knew the role wasn't for you — pace the realization", theme: "work" },
    { id: "deliver_044", text: "Recount a difficult conversation that fixed something — slow at the turn", theme: "work" },
    { id: "deliver_045", text: "Describe the first day of a new job — let the unfamiliarity breathe", theme: "work" },
    { id: "deliver_046", text: "Talk about why curiosity matters — pause between the example and the lesson", theme: "abstract" },
    { id: "deliver_047", text: "Describe what discipline looks like — slow on the part nobody sees", theme: "abstract" },
    { id: "deliver_048", text: "Tell why you believe in second chances — let the conviction land", theme: "abstract" },
    { id: "deliver_049", text: "Talk about the value of silence in a conversation — model it as you speak", theme: "abstract" },
    { id: "deliver_050", text: "Describe what trust feels like when it's earned — slow on the proof", theme: "abstract" },
    { id: "deliver_051", text: "Talk about why effort matters more than outcome — pause before the why", theme: "abstract" },
    { id: "deliver_052", text: "Describe what it means to grow up — let the change settle", theme: "abstract" },
    { id: "deliver_053", text: "Talk about why kindness isn't soft — slow on the example", theme: "abstract" },
    { id: "deliver_054", text: "Describe the difference between confidence and ego — let the line breathe", theme: "abstract" },
    { id: "deliver_055", text: "Talk about why you forgave someone — pace the journey, not the verdict", theme: "abstract" },
    { id: "deliver_056", text: "Describe a value you'd never compromise — slow when you name it", theme: "abstract" },
    { id: "deliver_057", text: "Talk about why beginnings matter more than endings — let the framing land", theme: "abstract" },
    { id: "deliver_058", text: "Describe what it means to live deliberately — slow on what you do daily", theme: "abstract" },
    { id: "deliver_059", text: "Talk about why honesty is harder than it sounds — pace the cost", theme: "abstract" },
    { id: "deliver_060", text: "Describe what it means to be a good neighbor — slow on a specific moment", theme: "abstract" },
    { id: "deliver_061", text: "Tell about a hike that went sideways — pace the moment things turned", theme: "life" },
    { id: "deliver_062", text: "Recount the first time you cooked a meal for someone — slow on the silence", theme: "life" },
    { id: "deliver_063", text: "Describe a song that changed how you thought — beat the chorus", theme: "life" },
    { id: "deliver_064", text: "Tell about a phone call you'll never forget — pace the line that stuck", theme: "life" },
    { id: "deliver_065", text: "Recount the moment you realized your parents were people — slow on the shift", theme: "life" },
    { id: "deliver_066", text: "Describe a meeting where someone stood up for you — pause on the line", theme: "work" },
    { id: "deliver_067", text: "Tell about a project you killed yourself — let the silence after land", theme: "work" },
    { id: "deliver_068", text: "Recount the day you got promoted — pace the moment of the decision", theme: "work" },
    { id: "deliver_069", text: "Describe leaving a job you loved — slow at the final goodbye", theme: "work" },
    { id: "deliver_070", text: "Tell about a difficult boss you eventually understood — pace the realization", theme: "work" },
    { id: "deliver_071", text: "Talk about why patience is undervalued — let the long pause prove it", theme: "abstract" },
    { id: "deliver_072", text: "Describe what gratitude feels like when it's deep — slow on the why", theme: "abstract" },
    { id: "deliver_073", text: "Talk about how good leaders use silence — model it", theme: "abstract" },
    { id: "deliver_074", text: "Describe why some lessons take a decade to land — pace your own example", theme: "abstract" },
    { id: "deliver_075", text: "Talk about the difference between knowing and understanding — let the shift breathe", theme: "abstract" },
  ],
  handle_pressure: [
    { id: "handle_pressure_001", text: "You're explaining why exercising is important. Someone says: 'That doesn't make sense.' Respond.", theme: "life" },
    { id: "handle_pressure_002", text: "You're saying people should limit social media. Someone says: 'I don't agree.' Respond.", theme: "life" },
    { id: "handle_pressure_003", text: "You're explaining saving money. Someone says: 'Why does this matter?' Respond.", theme: "life" },
    { id: "handle_pressure_004", text: "You're suggesting waking up early. Someone says: 'This is unnecessary.' Respond.", theme: "life" },
    { id: "handle_pressure_005", text: "You're proposing reading more. Someone says: 'That won't work.' Respond.", theme: "life" },
    { id: "handle_pressure_006", text: "You're advocating for routines. Someone says: 'I find routines suffocating.' Respond.", theme: "life" },
    { id: "handle_pressure_007", text: "You're recommending meditation. Someone says: 'That's a waste of time.' Respond.", theme: "life" },
    { id: "handle_pressure_008", text: "You're explaining why feedback is important. Someone says: 'Feedback is just criticism.' Respond.", theme: "work" },
    { id: "handle_pressure_009", text: "You're encouraging skill learning. Someone says: 'I'm too old for that.' Respond.", theme: "life" },
    { id: "handle_pressure_010", text: "You're making a case for sleep. Someone says: 'I function fine on 5 hours.' Respond.", theme: "life" },
    { id: "handle_pressure_011", text: "You're suggesting writing things down. Someone says: 'I remember everything.' Respond.", theme: "life" },
    { id: "handle_pressure_012", text: "You're recommending walks. Someone says: 'That's not real exercise.' Respond.", theme: "life" },
    { id: "handle_pressure_013", text: "You're advocating taking breaks. Someone says: 'Breaks make me lazy.' Respond.", theme: "work" },
    { id: "handle_pressure_014", text: "You're explaining why listening matters. Someone says: 'I'd rather be talking.' Respond.", theme: "life" },
    { id: "handle_pressure_015", text: "You're recommending journaling. Someone says: 'That's for teenagers.' Respond.", theme: "life" },
    { id: "handle_pressure_016", text: "You're advocating for taking a sabbatical. Someone says: 'You'll come back behind everyone else.' Respond.", theme: "work" },
    { id: "handle_pressure_017", text: "You're explaining why your team works asynchronously. Someone says: 'That's just an excuse to avoid meetings.' Respond.", theme: "work" },
    { id: "handle_pressure_018", text: "You're pitching that a junior should run the next launch. Someone says: 'They'll fold under pressure.' Respond.", theme: "work" },
    { id: "handle_pressure_019", text: "You're saying writing matters more than meetings. Someone says: 'Nobody reads anything anymore.' Respond.", theme: "work" },
    { id: "handle_pressure_020", text: "You're proposing the team kill a feature. Someone says: 'Customers loved it.' Respond.", theme: "work" },
    { id: "handle_pressure_021", text: "You're saying your team should hire slow. Someone says: 'We're losing the race.' Respond.", theme: "work" },
    { id: "handle_pressure_022", text: "You're advocating writing tests first. Someone says: 'That doubles the time we ship in.' Respond.", theme: "work" },
    { id: "handle_pressure_023", text: "You're recommending a tool the team hasn't used. Someone says: 'You're just chasing trends.' Respond.", theme: "work" },
    { id: "handle_pressure_024", text: "You're proposing a pricing change. Someone says: 'Sales will revolt.' Respond.", theme: "work" },
    { id: "handle_pressure_025", text: "You're pushing back on a customer ask. Someone says: 'They're our biggest account.' Respond.", theme: "work" },
    { id: "handle_pressure_026", text: "You're championing a hire who lacks the typical resume. Someone says: 'They'll never fit in.' Respond.", theme: "work" },
    { id: "handle_pressure_027", text: "You're proposing fewer 1:1s. Someone says: 'My team will feel ignored.' Respond.", theme: "work" },
    { id: "handle_pressure_028", text: "You're suggesting the team take Fridays off this month. Someone says: 'We'll miss the quarter.' Respond.", theme: "work" },
    { id: "handle_pressure_029", text: "You're insisting on a launch delay. Someone says: 'The board is expecting it.' Respond.", theme: "work" },
    { id: "handle_pressure_030", text: "You're advocating for a more diverse panel. Someone says: 'We need the most qualified, full stop.' Respond.", theme: "work" },
    { id: "handle_pressure_031", text: "You're saying time alone is essential. Someone says: 'You're just antisocial.' Respond.", theme: "life" },
    { id: "handle_pressure_032", text: "You're recommending therapy to a friend. They say: 'I just need to power through.' Respond.", theme: "life" },
    { id: "handle_pressure_033", text: "You're encouraging a partner to slow down. They say: 'I can't afford to.' Respond.", theme: "life" },
    { id: "handle_pressure_034", text: "You're saying kids don't need every activity. A parent says: 'Mine will fall behind.' Respond.", theme: "life" },
    { id: "handle_pressure_035", text: "You're suggesting a friend take a real vacation. They say: 'My job won't let me.' Respond.", theme: "life" },
    { id: "handle_pressure_036", text: "You're pushing strength training over cardio. Someone says: 'I just want to be lean.' Respond.", theme: "life" },
    { id: "handle_pressure_037", text: "You're saying a tough conversation is needed. Someone says: 'Why ruin the holiday?' Respond.", theme: "life" },
    { id: "handle_pressure_038", text: "You're suggesting your friend cancel a wedding. They say: 'It's too late to call it off.' Respond.", theme: "life" },
    { id: "handle_pressure_039", text: "You're advocating saving more. Someone says: 'I want to live now, not later.' Respond.", theme: "life" },
    { id: "handle_pressure_040", text: "You're recommending less screen time. Someone says: 'It's how I unwind.' Respond.", theme: "life" },
    { id: "handle_pressure_041", text: "You're suggesting a friend leave a relationship. They say: 'You don't know the whole story.' Respond.", theme: "life" },
    { id: "handle_pressure_042", text: "You're suggesting your sibling move closer to family. They say: 'My career is here.' Respond.", theme: "life" },
    { id: "handle_pressure_043", text: "You're recommending early retirement to a friend. They say: 'I'd be bored.' Respond.", theme: "life" },
    { id: "handle_pressure_044", text: "You're saying it's okay to not have kids. A relative says: 'You'll regret it.' Respond.", theme: "life" },
    { id: "handle_pressure_045", text: "You're suggesting a friend stop drinking. They say: 'It's not a problem.' Respond.", theme: "life" },
    { id: "handle_pressure_046", text: "You're saying you don't need a degree to be successful. Someone says: 'That's survivor bias.' Respond.", theme: "abstract" },
    { id: "handle_pressure_047", text: "You're saying social media is net negative. Someone says: 'It's how communities form now.' Respond.", theme: "abstract" },
    { id: "handle_pressure_048", text: "You're saying optimism is a discipline. Someone says: 'No, it's denial.' Respond.", theme: "abstract" },
    { id: "handle_pressure_049", text: "You're saying boredom helps creativity. Someone says: 'Then why do all your best ideas come from work?' Respond.", theme: "abstract" },
    { id: "handle_pressure_050", text: "You're saying happiness isn't the goal. Someone says: 'Then what is, suffering?' Respond.", theme: "abstract" },
    { id: "handle_pressure_051", text: "You're saying AI won't replace creative work. Someone says: 'You're underestimating the curve.' Respond.", theme: "abstract" },
    { id: "handle_pressure_052", text: "You're saying voting still matters. Someone says: 'It hasn't fixed anything.' Respond.", theme: "abstract" },
    { id: "handle_pressure_053", text: "You're saying we should slow down on AI deployment. Someone says: 'You'll lose to whoever doesn't.' Respond.", theme: "abstract" },
    { id: "handle_pressure_054", text: "You're saying small talk has value. Someone says: 'It's the worst part of being an adult.' Respond.", theme: "abstract" },
    { id: "handle_pressure_055", text: "You're saying privacy still matters. Someone says: 'Nobody under 25 cares.' Respond.", theme: "abstract" },
    { id: "handle_pressure_056", text: "You're saying long-form reading is dying. Someone says: 'People read more than ever, just differently.' Respond.", theme: "abstract" },
    { id: "handle_pressure_057", text: "You're saying climate adaptation matters as much as mitigation. Someone says: 'That's giving up.' Respond.", theme: "abstract" },
    { id: "handle_pressure_058", text: "You're saying inequality is unsustainable. Someone says: 'It's always existed.' Respond.", theme: "abstract" },
    { id: "handle_pressure_059", text: "You're saying productivity culture is broken. Someone says: 'It's how anything gets done.' Respond.", theme: "abstract" },
    { id: "handle_pressure_060", text: "You're saying universal basic income would work. Someone says: 'People won't work if you pay them anyway.' Respond.", theme: "abstract" },
    { id: "handle_pressure_061", text: "You're advocating for fewer side projects. A peer says: 'How will you stay sharp?' Respond.", theme: "work" },
    { id: "handle_pressure_062", text: "You're proposing the team go all in on one bet. Someone says: 'That's how startups die.' Respond.", theme: "work" },
    { id: "handle_pressure_063", text: "You're suggesting your boss work less. They say: 'Easy for you to say.' Respond.", theme: "work" },
    { id: "handle_pressure_064", text: "You're advocating taking the slow promotion. A peer says: 'You'll get passed over.' Respond.", theme: "work" },
    { id: "handle_pressure_065", text: "You're proposing a four-day workweek. Someone says: 'Output will drop.' Respond.", theme: "work" },
    { id: "handle_pressure_066", text: "You're suggesting a friend stop dating apps. They say: 'How else do you meet people?' Respond.", theme: "life" },
    { id: "handle_pressure_067", text: "You're advocating eating out less. Someone says: 'It's the only fun I have.' Respond.", theme: "life" },
    { id: "handle_pressure_068", text: "You're suggesting more hand-written notes. Someone says: 'That's a hassle nobody appreciates.' Respond.", theme: "life" },
    { id: "handle_pressure_069", text: "You're saying social plans should be smaller. Someone says: 'I love big parties.' Respond.", theme: "life" },
    { id: "handle_pressure_070", text: "You're advocating fewer subscriptions. Someone says: 'They're how I treat myself.' Respond.", theme: "life" },
    { id: "handle_pressure_071", text: "You're saying ambition has costs. Someone says: 'You're rationalizing complacency.' Respond.", theme: "abstract" },
    { id: "handle_pressure_072", text: "You're saying success can be quiet. Someone says: 'Then how do you know you've made it?' Respond.", theme: "abstract" },
    { id: "handle_pressure_073", text: "You're saying community matters more than career. Someone says: 'That's a luxury.' Respond.", theme: "abstract" },
    { id: "handle_pressure_074", text: "You're saying everyone needs a mentor. Someone says: 'Mentors are overrated.' Respond.", theme: "abstract" },
    { id: "handle_pressure_075", text: "You're saying confidence is a skill. Someone says: 'Some people are just born with it.' Respond.", theme: "abstract" },
  ],
};

function fisherYates<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Stratified sampling. Round-robins across present themes (work / life /
 * abstract) before doubling up, so a slate covers every present theme
 * when `count >= present-theme count`. Theme visit order is shuffled per
 * call so consecutive refreshes vary the blend, not just permute it.
 *
 * Why this matters: a flat shuffle on a work-heavy bank surfaces work
 * prompts disproportionately; users perceive the bank as "all corporate"
 * even when the bank is large. Stratification eliminates that.
 */
function pickStratifiedByTheme(
  bank: readonly WorkoutPrompt[],
  count: number,
  rand: () => number = Math.random,
): WorkoutPrompt[] {
  if (bank.length === 0 || count <= 0) return [];

  const buckets: Record<WorkoutTheme, WorkoutPrompt[]> = {
    work: [],
    life: [],
    abstract: [],
  };
  for (const p of bank) buckets[p.theme].push(p);

  const ordered: Record<WorkoutTheme, WorkoutPrompt[]> = {
    work: fisherYates(buckets.work, rand),
    life: fisherYates(buckets.life, rand),
    abstract: fisherYates(buckets.abstract, rand),
  };

  const presentThemes: WorkoutTheme[] = (
    Object.keys(ordered) as WorkoutTheme[]
  ).filter((t) => ordered[t].length > 0);
  const themeOrder = fisherYates(presentThemes, rand);

  const picked: WorkoutPrompt[] = [];
  while (picked.length < count) {
    let advanced = false;
    for (const theme of themeOrder) {
      if (picked.length >= count) break;
      const next = ordered[theme].shift();
      if (next) {
        picked.push(next);
        advanced = true;
      }
    }
    if (!advanced) break; // all buckets drained
  }
  return picked;
}

/**
 * O(1) id → prompt lookup, built once at module load. The expansion-pass
 * banks (1500+ prompts) make per-call linear scans untenable for the
 * history filter, which calls getById per candidate during filtering.
 */
const WORKOUT_PROMPT_INDEX: ReadonlyMap<string, WorkoutPrompt> = (() => {
  const map = new Map<string, WorkoutPrompt>();
  for (const bank of Object.values(WORKOUT_PROMPTS)) {
    for (const p of bank) map.set(p.id, p);
  }
  return map;
})();

/** Look up a single workout prompt object by id. */
export function getWorkoutPromptById(id: string): WorkoutPrompt | undefined {
  return WORKOUT_PROMPT_INDEX.get(id);
}

/** Theme of a given workout prompt id, for telemetry / picker rebalancing. */
export function getWorkoutPromptTheme(id: string): WorkoutTheme | undefined {
  return WORKOUT_PROMPT_INDEX.get(id)?.theme;
}

/**
 * Pick N prompt objects from a rep type's bank using stratified theme
 * sampling. The object form preserves stable ids so the per-user history
 * filter can record what was shown without round-tripping through text.
 *
 * Round-robins across present themes (work / life / abstract) before
 * doubling up, so a 5-prompt slate always shows variety when the bank
 * has multiple themes. Theme visit order shuffles per call.
 *
 * `excludeIds` filters the candidate pool. Falls back to the seen pool
 * only when filtering empties the bank, so a power user past saturation
 * still sees prompts — just ones they've seen before.
 */
export function pickWorkoutPromptObjects(
  repType: RepTypeId,
  count: number = 5,
  opts: { rand?: () => number; excludeIds?: ReadonlySet<string> } = {},
): WorkoutPrompt[] {
  const bank = WORKOUT_PROMPTS[repType];
  if (!bank || bank.length === 0) return [];

  const exclude = opts.excludeIds;
  if (!exclude || exclude.size === 0) {
    return pickStratifiedByTheme(bank, count, opts.rand);
  }

  const unseen = bank.filter((p) => !exclude.has(p.id));
  // Saturation fallback: when every prompt has been seen, pick from the
  // full bank rather than returning nothing — the user sees a familiar
  // prompt instead of an empty slate.
  const pool = unseen.length > 0 ? unseen : bank;
  const picks = pickStratifiedByTheme(pool, count, opts.rand);

  // Top up from the seen pool when the unseen pool was non-empty but
  // smaller than `count`. Maintains slate size at the cost of mixing in
  // a familiar prompt — better than serving fewer than 5.
  if (picks.length < count && pool === unseen && unseen.length < bank.length) {
    const seen = bank.filter((p) => exclude.has(p.id));
    const extras = pickStratifiedByTheme(seen, count - picks.length, opts.rand);
    return [...picks, ...extras];
  }
  return picks;
}

/** Text-returning picker — thin wrapper for callers that don't need ids. */
export function pickWorkoutPrompts(
  repType: RepTypeId,
  count: number = 5,
  opts: { rand?: () => number; excludeIds?: ReadonlySet<string> } = {},
): string[] {
  return pickWorkoutPromptObjects(repType, count, opts).map((p) => p.text);
}

/** Total number of prompts available in a rep type's bank. */
export function workoutBankSize(repType: RepTypeId): number {
  return WORKOUT_PROMPTS[repType]?.length ?? 0;
}

/**
 * Pick N prompts blending rep-type drills with the user's vertical
 * scenarios. Default mix: ~60% rep-type / ~40% vertical so users see
 * industry-specific flavor without losing the drill focus.
 *
 * Falls back to pure rep-type prompts when no vertical is provided or
 * the vertical bank is empty — identical to pickWorkoutPrompts in
 * that case, so swapping this in is safe.
 */
export function pickBlendedWorkoutPrompts(
  repType: RepTypeId,
  vertical: VerticalId | undefined | null,
  count: number = 5,
  opts: { excludeIds?: ReadonlySet<string> } = {},
): string[] {
  return pickBlendedWorkoutPromptObjects(repType, vertical, count, opts).map(
    (p) => p.text,
  );
}

/**
 * Object-form blended picker — same shape as pickBlendedWorkoutPrompts
 * but returns the typed prompt objects so callers can record stable ids
 * via /api/prompt-history. Each result is either a WorkoutPrompt or a
 * VerticalPrompt; both share `id` and `text` fields.
 */
export function pickBlendedWorkoutPromptObjects(
  repType: RepTypeId,
  vertical: VerticalId | undefined | null,
  count: number = 5,
  opts: { excludeIds?: ReadonlySet<string> } = {},
): Array<WorkoutPrompt | VerticalPrompt> {
  const repTypeBank = WORKOUT_PROMPTS[repType] ?? [];
  if (!vertical) {
    return pickWorkoutPromptObjects(repType, count, {
      ...(opts.excludeIds ? { excludeIds: opts.excludeIds } : {}),
    });
  }

  if (verticalBankSize(vertical) === 0) {
    return pickWorkoutPromptObjects(repType, count, {
      ...(opts.excludeIds ? { excludeIds: opts.excludeIds } : {}),
    });
  }

  const verticalShare = Math.max(1, Math.round(count * 0.4));
  const repTypeShare = Math.max(1, count - verticalShare);

  const repTypePicks = pickWorkoutPromptObjects(repType, repTypeShare, {
    ...(opts.excludeIds ? { excludeIds: opts.excludeIds } : {}),
  });
  const verticalPicks = pickVerticalPromptObjects(
    vertical,
    verticalShare,
    opts.excludeIds ? { excludeIds: opts.excludeIds } : {},
  );

  // De-dup by text — banks across rep types and verticals carry distinct
  // ids, so id-based dedup wouldn't catch the case that actually fires
  // here: an authoring overlap where two banks happen to ship the same
  // sentence. Text dedup is the right key for cross-bank blending.
  const seen = new Set<string>();
  const blend: Array<WorkoutPrompt | VerticalPrompt> = [];
  for (const p of [...verticalPicks, ...repTypePicks]) {
    if (!seen.has(p.text)) {
      seen.add(p.text);
      blend.push(p);
    }
  }
  // Final shuffle so vertical picks don't always cluster at the top.
  for (let i = blend.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [blend[i], blend[j]] = [blend[j]!, blend[i]!];
  }
  return blend.slice(0, count);
}
