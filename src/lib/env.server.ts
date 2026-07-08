/**
 * Server-only environment schema. Parsed once at module load by
 * `instrumentation.ts` so a missing required key fails the boot
 * loudly in prod instead of throwing the first time a request
 * reaches the code path.
 *
 * In dev/preview, missing required keys log a warn and the helpers
 * in env.ts handle the fallback degradation per-feature. In prod
 * we throw — silent degradation in prod hides real bugs.
 */

import { z } from "zod";
import { getRuntime } from "./env";

const ServerEnvSchema = z.object({
  // — Database / Auth —
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // — AI providers —
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  DEEPGRAM_API_KEY: z.string().min(1, "DEEPGRAM_API_KEY is required"),

  // — Cron + internal secrets —
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be ≥ 16 chars"),
  INTERNAL_SCORING_SECRET: z
    .string()
    .min(16, "INTERNAL_SCORING_SECRET must be ≥ 16 chars"),

  // — Optional —
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  HUME_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/**
 * Parse-or-throw. In prod a missing required key throws (fail-fast).
 * In dev/preview we log the issues and return a best-effort partial
 * shape so local development doesn't require every key to be set.
 */
export function loadServerEnv(): ServerEnv {
  const result = ServerEnvSchema.safeParse(process.env);
  if (result.success) return result.data;

  const runtime = getRuntime();
  const issues = result.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");

  if (runtime === "production") {
    throw new Error(
      `Invalid server environment in production. Failing boot.\n${issues}`,
    );
  }

  console.warn(
    `[env.server] ${runtime} env failed validation. Falling back to ` +
      `degraded mode (env.ts helpers will guard per-feature):\n${issues}`,
  );
  // Return process.env loosely typed — feature-level helpers in env.ts
  // are responsible for guarding individual missing keys.
  return process.env as unknown as ServerEnv;
}

/** Cached parse result for downstream callers that want it directly. */
let cached: ServerEnv | null = null;
export function serverEnv(): ServerEnv {
  if (!cached) cached = loadServerEnv();
  return cached;
}
