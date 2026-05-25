/**
 * Next.js instrumentation hook. Runs once on server boot before any
 * request is served. We use it to parse the server-side env schema so
 * a missing required key fails the boot in prod instead of throwing
 * the first time a request hits the broken code path.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadServerEnv } = await import("./src/lib/env.server");
    loadServerEnv();
  }
}
