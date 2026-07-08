/**
 * Structured logger. Writes JSON lines to stdout/stderr so Vercel log
 * drains and ad-hoc grepping both get a parseable shape. No SDK; the
 * audit (PR-4) found 95 ad-hoc console.* sites — this is the codemod
 * target so they all share a shape.
 *
 * Usage:
 *   log.info({ event: "cron.start", cron: "muscle-group-day-rollover" });
 *   log.warn({ event: "weekly_reports.narrative_invalid", userId, issues });
 *   log.error({ event: "score.failed", repId, err: serializeErr(err) });
 *
 * Convention: `event` is the always-present discriminator key, written in
 * snake_case with a dotted namespace (area.action). Anything else is
 * payload. The logger adds `ts` and `level` automatically.
 */

type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown> & { event: string };

function emit(level: LogLevel, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    ...fields,
  });
  // info/warn → stdout (Vercel collects), error → stderr (page when wired).
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  info(fields: LogFields): void {
    emit("info", fields);
  },
  warn(fields: LogFields): void {
    emit("warn", fields);
  },
  error(fields: LogFields): void {
    emit("error", fields);
  },
};

/**
 * Serialize an unknown error to a small, JSON-safe shape. Avoids dumping
 * the entire Error prototype chain or circular refs.
 */
export function serializeErr(err: unknown): {
  message: string;
  name?: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      // Trim the stack so log lines don't blow past 8 KB. Top 5 frames is
      // usually enough to triage; pull full repro from logs if needed.
      stack: err.stack?.split("\n").slice(0, 6).join("\n"),
    };
  }
  return { message: String(err) };
}
