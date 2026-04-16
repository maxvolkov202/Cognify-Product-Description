import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const KNOWLEDGE_ROOT = join(process.cwd(), "src/lib/ai/knowledge");

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

// Module-level cache. On serverless cold start, the first call for each
// subdir reads from disk; subsequent calls in the same warm instance hit
// the cache. Cache is invalidated on process restart.
const _cache: Map<string, KnowledgeBlock[]> = new Map();

function loadDir(subdir: string, category: KnowledgeCategory): KnowledgeBlock[] {
  const key = `${subdir}:${category}`;
  const cached = _cache.get(key);
  if (cached) return cached;

  const dir = join(KNOWLEDGE_ROOT, subdir);
  try {
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md",
    );
    const blocks = files.map((file) => ({
      id: file.replace(/\.md$/, ""),
      category,
      content: readFileSync(join(dir, file), "utf-8"),
    }));
    _cache.set(key, blocks);
    return blocks;
  } catch {
    _cache.set(key, []);
    return [];
  }
}

export function loadFrameworks(): KnowledgeBlock[] {
  return loadDir("frameworks", "framework");
}

export function loadSkills(): KnowledgeBlock[] {
  return loadDir("skills", "skill");
}

export function loadDomains(): KnowledgeBlock[] {
  return loadDir("domains", "domain");
}

export function loadPatterns(): KnowledgeBlock[] {
  return loadDir("patterns", "pattern");
}

export function loadProgression(): KnowledgeBlock[] {
  return loadDir("progression", "progression");
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

/**
 * Resolve which knowledge blocks to include for a given pipeline stage.
 *
 * Hand-rolled matching for now. Once external-validation data
 * accumulates, a calibration regression will learn which knowledge
 * blocks actually predict blind-listener preference per stage, and
 * these match rules will be replaced with learned weights.
 */
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
 * Force the loader to clear its cache. Exposed for debug tooling
 * and test harnesses. Do not call in production request paths.
 */
export function __clearKnowledgeCache(): void {
  _cache.clear();
}
