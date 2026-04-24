import { currentUser } from "@/lib/session/current-user";
import { getLeaderboard } from "@/lib/db/queries/leaderboard";
import { LeaderboardTabs } from "@/components/product/LeaderboardTabs";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeDb } from "@/lib/db/safe";

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

  const [global, thisWeek, team, userInTeam] = await Promise.all([
    getLeaderboard({ scope: "global", userId }),
    getLeaderboard({ scope: "this_week", userId }),
    getLeaderboard({ scope: "team", userId }),
    userId ? isUserInTeam(userId) : Promise.resolve(false),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <LeaderboardTabs
        global={global}
        thisWeek={thisWeek}
        team={team}
        userInTeam={userInTeam}
      />
    </div>
  );
}
