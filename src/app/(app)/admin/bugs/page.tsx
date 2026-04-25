import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { eq, inArray } from "drizzle-orm";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { db } from "@/lib/db/client";
import { bugReports, users } from "@/lib/db/schema";
import { getBugScreenshotSignedUrl } from "@/lib/bug-reports/storage";
import { BugAdminClient } from "./BugAdminClient";

export const dynamic = "force-dynamic";

type SearchParams = {
  status?: string;
};

export default async function BugAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await currentUser();
  if (!user) notFound();
  const profile = await getUserProfile(user.id);
  if (!profile?.isOperator) notFound();

  const params = await searchParams;
  const filter = (params?.status ?? "open") as
    | "open"
    | "in_progress"
    | "fixed"
    | "wontfix"
    | "duplicate"
    | "all";

  const rows =
    filter === "all"
      ? await db
          .select()
          .from(bugReports)
          .orderBy(desc(bugReports.createdAt))
          .limit(200)
      : await db
          .select()
          .from(bugReports)
          .where(eq(bugReports.status, filter))
          .orderBy(desc(bugReports.createdAt))
          .limit(200);

  const reporterIds = Array.from(
    new Set(rows.map((r) => r.userId).filter((x): x is string => !!x)),
  );
  const reporters = reporterIds.length
    ? await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(inArray(users.id, reporterIds))
    : [];
  const reporterById = new Map(reporters.map((u) => [u.id, u]));

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const imageUrls = await Promise.all(
        (r.imagePaths ?? []).map((p) => getBugScreenshotSignedUrl(p)),
      );
      return {
        id: r.id,
        userId: r.userId,
        description: r.description,
        imageUrls: imageUrls.filter((u): u is string => !!u),
        userAgent: r.userAgent,
        route: r.route,
        status: r.status,
        resolutionNote: r.resolutionNote,
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        reporter: r.userId ? reporterById.get(r.userId) ?? null : null,
      };
    }),
  );

  return <BugAdminClient initialFilter={filter} reports={enriched} />;
}
