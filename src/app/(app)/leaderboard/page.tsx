import { currentUser } from "@/lib/session/current-user";
import { getLeaderboard } from "@/lib/db/queries/leaderboard";
import { LeaderboardTabs } from "@/components/product/LeaderboardTabs";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeDb } from "@/lib/db/safe";
import { isRankSystemEnabled } from "@/lib/flags";

export const dynamic = "force-dynamic";

async function isUserInTeam(userId: string): Promise<boolean> {
  return safeDb(async () => {
    const rows = await db
      .select({ teamId: memberships.teamId })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .limit(1);
    return rows.length > 0;
  }, false);
}

export default async function LeaderboardPage() {
  const user = await currentUser();
  const userId = user?.id ?? null;
  // PRD v3 Phase 6 (§10.9) — under FF_RANK_SYSTEM the default board is
  // weekly IMPROVEMENT and a Communication Score board joins the tabs.
  const v2 = isRankSystemEnabled();

  const [global, thisWeek, team, userInTeam, rankBoard] = await Promise.all([
    getLeaderboard({ scope: "global", userId }),
    getLeaderboard({ scope: "this_week", userId }),
    // In v2 the team board uses the same fair rank→composite ordering as the
    // main board so both tabs read consistently.
    getLeaderboard({
      scope: "team",
      userId,
      metric: v2 ? "rank" : "composite",
    }),
    userId ? isUserInTeam(userId) : Promise.resolve(false),
    // "Top communicators" (default): primary sort by Cognify Rank, secondary
    // by composite within each rank (§10.5.1) — seniority + sustained training
    // lead, communication quality breaks ties. One lucky rep can't top it.
    v2
      ? getLeaderboard({ scope: "global", userId, metric: "rank" })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <LeaderboardTabs
        global={global}
        thisWeek={thisWeek}
        team={team}
        userInTeam={userInTeam}
        rankBoard={rankBoard}
      />
    </div>
  );
}
