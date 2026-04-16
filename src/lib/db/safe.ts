export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function safeDb<T>(
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await operation();
  } catch (error) {
    console.error("[db] operation failed — returning fallback", error);
    return fallback;
  }
}

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function hasDeepgram(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

export function hasAudioStorage(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
