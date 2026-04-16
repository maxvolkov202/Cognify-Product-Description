import type { SkillDimension } from "@/types/domain";
import { loadSkill } from "./index";

/**
 * Parsed excerpt from a skill knowledge file, shaped for UI popovers.
 * The knowledge MDs are long — this extracts the specific sections
 * we want to show users as visible grounding for a scoring callout.
 */
export type SkillExcerpt = {
  dimension: SkillDimension;
  title: string;
  definition: string;
  highSignal: string[];
  lowSignal: string[];
  sources: string[];
};

/**
 * Parse a skill MD into a UI-ready excerpt. Looks for the canonical
 * section headings we use in src/lib/ai/knowledge/skills/*.md and
 * extracts just enough to explain WHY a callout lands the way it does.
 *
 * Returns null if the dimension has no knowledge file.
 */
export function getSkillExcerpt(dimension: SkillDimension): SkillExcerpt | null {
  const block = loadSkill(dimension);
  if (!block) return null;

  const md = block.content;

  const definition = extractSection(md, "Definition") ?? extractSummary(md);
  const highSignal = extractBullets(md, `What great ${dimension} sounds like`);
  const lowSignal = extractBullets(md, `What low ${dimension} sounds like`);
  const sources = extractBullets(md, "Experts and sources");

  return {
    dimension,
    title: titleCase(dimension),
    definition: trimWords(definition, 80),
    highSignal: highSignal.slice(0, 4).map((s) => trimWords(s, 30)),
    lowSignal: lowSignal.slice(0, 4).map((s) => trimWords(s, 30)),
    sources: sources.slice(0, 5).map(stripMarkdown).map((s) => trimWords(s, 30)),
  };
}

function extractSection(md: string, heading: string): string | null {
  const re = new RegExp(
    `##\\s+${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    "i",
  );
  const match = md.match(re);
  if (!match?.[1]) return null;
  return collapseWhitespace(match[1]);
}

function extractBullets(md: string, heading: string): string[] {
  const re = new RegExp(
    `##\\s+${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    "i",
  );
  const match = md.match(re);
  if (!match?.[1]) return [];
  return match[1]
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-\s*/, ""))
    .filter((line) => line.length > 0);
}

/** Fall back to the first paragraph after the title. */
function extractSummary(md: string): string {
  const afterTitle = md.replace(/^#\s[^\n]*\n+/, "");
  const firstPara = afterTitle.split(/\n\s*\n/)[0] ?? "";
  return collapseWhitespace(firstPara.replace(/^>\s*/gm, ""));
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimWords(s: string, maxWords: number): string {
  const words = s.split(/\s+/);
  if (words.length <= maxWords) return s;
  return words.slice(0, maxWords).join(" ") + "…";
}

function stripMarkdown(s: string): string {
  return s.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "");
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
