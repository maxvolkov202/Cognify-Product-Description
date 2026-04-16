import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { GUEST_COOKIE } from "@/lib/session/current-user";
import { sendWelcomeEmail } from "@/lib/email/send";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret:
    process.env.AUTH_SECRET ??
    "cognify-dev-only-insecure-secret-replace-before-production-deploy",
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;
      if (!process.env.DATABASE_URL) return true;

      try {
        // Guest → account promotion: if there's a guest cookie with
        // existing data, update that row with the Google identity
        // instead of creating a new user. This preserves all workout
        // history, scores, and settings from the guest session.
        const store = await cookies();
        const guestId = store.get(GUEST_COOKIE)?.value;

        const existingByEmail = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });

        if (existingByEmail) {
          await db
            .update(users)
            .set({ name: user.name ?? existingByEmail.name, image: user.image ?? existingByEmail.image })
            .where(eq(users.id, existingByEmail.id));
        } else if (guestId) {
          const guestUser = await db.query.users.findFirst({
            where: eq(users.id, guestId),
          });
          if (guestUser && guestUser.isGuest) {
            await db
              .update(users)
              .set({
                email: user.email,
                name: user.name ?? null,
                image: user.image ?? null,
                isGuest: false,
                emailVerified: new Date(),
              })
              .where(eq(users.id, guestId));
          } else {
            await db.insert(users).values({
              email: user.email,
              name: user.name ?? null,
              image: user.image ?? null,
              emailVerified: new Date(),
            });
          }
        } else {
          await db.insert(users).values({
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            emailVerified: new Date(),
          });
        }

        if (guestId) store.delete(GUEST_COOKIE);

        // Fire-and-forget welcome email on first sign-in
        const isNewUser = !existingByEmail;
        if (isNewUser && user.email) {
          sendWelcomeEmail(user.email, user.name ?? null).catch(() => {});
        }
      } catch (error) {
        console.error("[auth] user upsert failed, continuing with JWT only", error);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email && process.env.DATABASE_URL) {
        try {
          const dbUser = await db.query.users.findFirst({
            where: eq(users.email, user.email),
          });
          if (dbUser) token.cognifyUserId = dbUser.id;
        } catch {
          // DB unavailable — fall back to token.sub from Google
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.cognifyUserId as string | undefined) ?? token.sub ?? "";
      }
      return session;
    },
  },
});
