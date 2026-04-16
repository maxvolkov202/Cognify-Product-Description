import {
  FRAMEWORKS_BLOCKS,
  SKILLS_BLOCKS,
  DOMAINS_BLOCKS,
  PATTERNS_BLOCKS,
  PROGRESSION_BLOCKS,
} from "./generated";

export type KnowledgeCategory =
  | "framework"
  | "skill"
  | "domain"
  | "pattern"
  | "progression";

export type KnowledgeBlock = {
  id: string;
  category: KnowledgeCategory;
  content: string;
};

// Knowledge is pre-bundled at build time (scripts/build-knowledge.mjs →
// ./generated.ts). This avoids any runtime fs.readFileSync — reliable in
// Vercel serverless functions where src/lib/ai/knowledge/*.md isn't
// guaranteed to be bundled.

function tag(
  blocks: ReadonlyArray<{ id: string; content: string }>,
  category: KnowledgeCategory,
): KnowledgeBlock[] {
  return blocks.map((b) => ({ id: b.id, category, content: b.content }));
}

export function loadFrameworks(): KnowledgeBlock[] {
  return tag(FRAMEWORKS_BLOCKS, "framework");
}

export function loadSkills(): KnowledgeBlock[] {
  return tag(SKILLS_BLOCKS, "skill");
}

export function loadDomains(): KnowledgeBlock[] {
  return tag(DOMAINS_BLOCKS, "domain");
}

export function loadPatterns(): KnowledgeBlock[] {
  return tag(PATTERNS_BLOCKS, "pattern");
}

export function loadProgression(): KnowledgeBlock[] {
  return tag(PROGRESSION_BLOCKS, "progression");
}

export function loadProgressionFor(dimension: string): KnowledgeBlock | null {
  return loadProgression().find((b) => b.id === dimension) ?? null;
}

export function loadSkill(dimension: string): KnowledgeBlock | null {
  return loadSkills().find((b) => b.id === dimension) ?? null;
}

export function loadFramework(frameworkId: string): KnowledgeBlock | null {
  return loadFrameworks().find((b) => b.id === frameworkId) ?? null;
}

export function loadDomain(domainId: string): KnowledgeBlock | null {
  return loadDomains().find((b) => b.id === domainId) ?? null;
}

/**
 * Render a list of knowledge blocks as a single string for inclusion
 * in a Claude system prompt. Each block is delimited so Claude can
 * reference blocks by id in its output.
 */
export function renderBlocks(blocks: KnowledgeBlock[]): string {
  if (blocks.length === 0) return "";
  return blocks
    .map(
      (b) =>
        `<${b.category} id="${b.id}">\n${b.content}\n</${b.category}>`,
    )
    .join("\n\n");
}

export type KnowledgeQuery =
  | { stage: "framework_gen"; domainHint?: string }
  | { stage: "score_skill"; skill: string }
  | { stage: "callout_compose" }
  | { stage: "prompt_gen"; domainHint?: string };

export function resolveKnowledge(query: KnowledgeQuery): KnowledgeBlock[] {
  switch (query.stage) {
    case "framework_gen": {
      const domain = query.domainHint ? loadDomain(query.domainHint) : null;
      return domain ? [...loadFrameworks(), domain] : loadFrameworks();
    }
    case "score_skill": {
      const skill = loadSkill(query.skill);
      const patterns = loadPatterns();
      return skill ? [skill, ...patterns] : patterns;
    }
    case "callout_compose":
      return loadPatterns();
    case "prompt_gen": {
      const domain = query.domainHint ? loadDomain(query.domainHint) : null;
      return domain ? [domain] : [];
    }
  }
}

/**
 * Legacy cache-clear hook. No-op now that knowledge is static at build
 * time. Kept for API compatibility with debug tooling.
 */
export function __clearKnowledgeCache(): void {
  // no-op
}
