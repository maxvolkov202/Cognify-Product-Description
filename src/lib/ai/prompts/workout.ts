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
