import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// Drizzle-kit doesn't auto-load .env.local, so do it here.
config({ path: ".env.local" });

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Restrict drizzle-kit to our dedicated schema so it never touches Bob's
  // v1 tables in `public`. Only cognify_v2.* is introspected/modified.
  schemaFilter: ["cognify_v2"],
  strict: true,
  verbose: true,
} satisfies Config;
