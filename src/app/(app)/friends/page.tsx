import {
  Users,
  Swords,
  Activity,
  UserPlus,
  Trophy,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  ChevronRight,
  Search,
  Zap,
  MessageCircle,
} from "lucide-react";
import { DemoBanner } from "@/components/shared/DemoBanner";
import {
  MOCK_FRIENDS,
  MOCK_PENDING_REQUESTS,
  MOCK_ACTIVITY,
  MOCK_CHALLENGES,
  MOCK_SUGGESTED,
} from "@/lib/friends/mock-data";
import type {
  FriendProfile,
  FriendActivity,
  Challenge,
} from "@/lib/friends/mock-data";
import { currentUser } from "@/lib/session/current-user";
import {
  getFriendsForUser,
  getPendingRequestsForUser,
  getChallengesForUser,
  type FriendRow,
  type PendingRequestRow,
  type ChallengeRow,
} from "@/lib/db/queries/friends";
import {
  getActivityFeedForUser,
  type ActivityRow,
} from "@/lib/db/queries/activity";
import Link from "next/link";
import { InviteFriendForm } from "@/components/product/InviteFriendForm";
import { AcceptDeclineButtons } from "@/components/product/FriendActionButtons";
import {
  ActivityFeedRow,
  Avatar,
  initials,
  relativeTime,
} from "@/components/product/friends/ActivityFeedRow";

export default async function FriendsPage() {
  const me = await currentUser();
  const [friends, pending, challenges, activity] = me
    ? await Promise.all([
        getFriendsForUser(me.id),
        getPendingRequestsForUser(me.id),
        getChallengesForUser(me.id),
        getActivityFeedForUser(me.id, { limit: 20 }),
      ])
    : [
        [] as FriendRow[],
        [] as PendingRequestRow[],
        [] as ChallengeRow[],
        [] as ActivityRow[],
      ];

  // Include challenges in the real-data signal — a challenges-only user
  // (sent + accepted a challenge but no friend rows yet) was falling
  // through to the MOCK preview (audit UX-6).
  const hasRealData =
    friends.length > 0 ||
    pending.length > 0 ||
    activity.length > 0 ||
    challenges.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Header />
      <InviteBanner hasRealData={hasRealData} />
      {hasRealData ? (
        <RealFriendsView
          friends={friends}
          pending={pending}
          challenges={challenges}
          activity={activity}
        />
      ) : (
        <MockFriendsPreview />
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
        Training partners
      </p>
      <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl dark:text-white">
        Your gym crew.
      </h1>
      <p className="mt-1 max-w-2xl text-lg text-ink-600 dark:text-ink-300">
        Train together, challenge each other, climb together. The best
        communicators don&rsquo;t practice alone.
      </p>
    </div>
  );
}

function InviteBanner({ hasRealData }: { hasRealData: boolean }) {
  return (
    <div className="mt-8 surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl shadow-sm">
            <UserPlus
              className="size-5 text-white"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
              Invite a friend
            </p>
            <p className="mt-0.5 text-sm font-bold text-ink-900 dark:text-white">
              {hasRealData
                ? "Add another teammate to your gym crew."
                : "Bring a real teammate in — this section fills out with real data once you do."}
            </p>
          </div>
        </div>
        <div className="md:w-[28rem]">
          <InviteFriendForm />
        </div>
      </div>
    </div>
  );
}

// ——— Real-data view ————————————————————————————————————————

function RealFriendsView({
  friends,
  pending,
  challenges,
  activity,
}: {
  friends: FriendRow[];
  pending: PendingRequestRow[];
  challenges: ChallengeRow[];
  activity: ActivityRow[];
}) {
  const activeChallenges = challenges.filter((c) => c.status !== "completed");
  const topFriend = friends[0];

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <QuickStat
          icon={<Users className="size-4" />}
          label="Friends"
          value={`${friends.length}`}
        />
        <QuickStat
          icon={<Zap className="size-4" />}
          label="Pending"
          value={`${pending.length}`}
        />
        <QuickStat
          icon={<Swords className="size-4" />}
          label="Active challenges"
          value={`${activeChallenges.length}`}
        />
        <QuickStat
          icon={<Trophy className="size-4" />}
          label="Top friend"
          value={topFriend?.name?.split(" ")[0] ?? "—"}
          sub={
            topFriend?.composite != null
              ? `${topFriend.composite} composite`
              : topFriend
                ? "No reps yet"
                : undefined
          }
        />
      </div>

      {pending.length > 0 && (
        <div className="mt-8">
          <div className="surface-card border-brand-purple/20 bg-brand-purple/[0.02] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-purple dark:text-brand-lavender">
              <UserPlus className="size-4" />
              {pending.length} friend request{pending.length > 1 ? "s" : ""}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {pending.map((req) => (
                <div
                  key={req.friendshipId}
                  className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-2.5 dark:border-ink-700 dark:bg-ink-900"
                >
                  <Avatar initials={initials(req.name)} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 dark:text-white">
                      {req.name ?? "Someone"}
                    </p>
                    <p className="text-[11px] text-ink-500 dark:text-ink-400">
                      Sent {relativeTime(req.createdAt)}
                    </p>
                  </div>
                  <div className="ml-2">
                    <AcceptDeclineButtons friendshipId={req.friendshipId} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Your friends
          </h2>
          <div className="mt-4 space-y-3">
            {friends.length === 0 ? (
              <EmptyCard text="No accepted friends yet. Pending requests appear above." />
            ) : (
              friends.map((f) => <RealFriendCard key={f.userId} friend={f} />)
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              <Swords className="size-3.5" /> Challenges
            </h2>
            <div className="mt-4 space-y-3">
              {challenges.length === 0 ? (
                <EmptyCard text="No challenges yet. Start one by clicking the swords icon on a friend." />
              ) : (
                challenges.map((c) => <RealChallengeCard key={c.id} c={c} />)
              )}
            </div>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              <Activity className="size-3.5" /> Live feed
            </h2>
            <div className="mt-4 space-y-1">
              {activity.length === 0 ? (
                <EmptyCard text="Activity lights up as your crew records reps." />
              ) : (
                activity.map((a) => <ActivityFeedRow key={a.id} row={a} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function RealFriendCard({ friend }: { friend: FriendRow }) {
  return (
    <div className="surface-card group flex items-center gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-glow)]">
      <Avatar initials={initials(friend.name)} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink-900 dark:text-white">
          {friend.name ?? friend.email ?? "Friend"}
        </p>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-500 dark:text-ink-400">
          <span>
            Joined {relativeTime(friend.joinedAt)}
          </span>
          <span>{friend.totalReps} reps</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="brand-gradient-text text-xl font-extrabold tabular-nums">
          {friend.composite ?? "—"}
        </span>
        <span className="text-[10px] text-ink-400 dark:text-ink-500">
          {friend.composite != null ? "composite" : "no reps yet"}
        </span>
      </div>
      <div className="flex gap-1.5">
        <Link
          href={`/friends/challenge?to=${friend.userId}`}
          className="rounded-lg border border-ink-200 p-1.5 text-ink-500 hover:border-brand-purple hover:text-brand-purple dark:border-ink-700 dark:text-ink-400 dark:hover:text-brand-lavender"
          title="Challenge"
          aria-label={`Challenge ${friend.name ?? "friend"}`}
        >
          <Swords className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function RealChallengeCard({ c }: { c: ChallengeRow }) {
  const statusColors = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    active: "bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-brand-lavender",
    completed: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
  } as const;

  return (
    <Link
      href={`/friends/challenge/${c.id}`}
      className="surface-card block p-4 transition hover:shadow-[var(--shadow-glow)]"
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColors[c.status]}`}
        >
          {c.status === "pending"
            ? "Pending"
            : c.status === "active"
              ? "In progress"
              : "Completed"}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-ink-400 dark:text-ink-500">
          <Clock className="size-3" />
          {c.expiresAt ? relativeTime(c.expiresAt) : "—"}
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-ink-700 dark:text-ink-200">
        &ldquo;{c.prompt}&rdquo;
      </p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-600 dark:text-ink-300">
        <span>
          {c.challengerName ?? "Challenger"}:{" "}
          <strong className="brand-gradient-text text-sm tabular-nums">
            {c.challengerScore ?? "—"}
          </strong>
        </span>
        <span className="text-xs font-black text-ink-300 dark:text-ink-600">VS</span>
        <span>
          {c.opponentName ?? "Opponent"}:{" "}
          <strong className="brand-gradient-text text-sm tabular-nums">
            {c.opponentScore ?? "—"}
          </strong>
        </span>
      </div>
    </Link>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-5 py-6 text-sm text-ink-500 dark:border-ink-700 dark:bg-ink-900/60 dark:text-ink-400">
      {text}
    </div>
  );
}

// ——— Mock preview (empty-state only) ——————————————————————————

function MockFriendsPreview() {
  const onlineFriends = MOCK_FRIENDS.filter((f) => f.status !== "offline");
  const topFriend = MOCK_FRIENDS[0];

  return (
    <>
      <div className="mt-8">
        <DemoBanner
          message="These friends, scores, and streaks aren't real. Invite a real teammate using the form above to activate this page with your actual network."
        />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <QuickStat
          icon={<Users className="size-4" />}
          label="Friends"
          value={`${MOCK_FRIENDS.length}`}
        />
        <QuickStat
          icon={<Zap className="size-4" />}
          label="Online now"
          value={`${onlineFriends.length}`}
        />
        <QuickStat
          icon={<Swords className="size-4" />}
          label="Active challenges"
          value={`${MOCK_CHALLENGES.filter((c) => c.status !== "completed").length}`}
        />
        <QuickStat
          icon={<Trophy className="size-4" />}
          label="Top friend"
          value={topFriend?.name.split(" ")[0] ?? "—"}
          sub={topFriend ? `${topFriend.composite} composite` : undefined}
        />
      </div>

      {MOCK_PENDING_REQUESTS.length > 0 && (
        <div className="mt-8">
          <div className="surface-card border-brand-purple/20 bg-brand-purple/[0.02] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-purple dark:text-brand-lavender">
              <UserPlus className="size-4" />
              {MOCK_PENDING_REQUESTS.length} friend request
              {MOCK_PENDING_REQUESTS.length > 1 ? "s" : ""}
              <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                Demo
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {MOCK_PENDING_REQUESTS.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-2.5"
                >
                  <Avatar initials={req.initials} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      {req.name}
                    </p>
                    <p className="text-[11px] text-ink-500">
                      {req.vertical} · {req.mutualFriends} mutual
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              Your friends (preview)
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
              <input
                type="text"
                placeholder="Search friends…"
                className="rounded-lg border border-ink-200 bg-white py-1.5 pl-8 pr-3 text-xs text-ink-700 placeholder:text-ink-400 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple/30 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:placeholder:text-ink-500"
                disabled
              />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {MOCK_FRIENDS.map((friend) => (
              <MockFriendCard key={friend.id} friend={friend} />
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              <Activity className="size-3.5" /> Live feed (preview)
            </h2>
            <div className="mt-4 space-y-1">
              {MOCK_ACTIVITY.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              <Swords className="size-3.5" /> Challenges (preview)
            </h2>
            <div className="mt-4 space-y-3">
              {MOCK_CHALLENGES.map((challenge) => (
                <MockChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
          People you might know (preview)
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {MOCK_SUGGESTED.map((person) => (
            <div key={person.id} className="surface-card p-4 text-center">
              <Avatar initials={person.initials} size="md" className="mx-auto" />
              <p className="mt-2 text-sm font-bold text-ink-900 dark:text-white">{person.name}</p>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                {person.vertical} · {person.composite} composite
              </p>
              <p className="text-[10px] text-ink-400 dark:text-ink-500">
                {person.mutualFriends} mutual friends
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MockFriendCard({ friend }: { friend: FriendProfile }) {
  return (
    <div className="surface-card group flex items-center gap-4 p-4">
      <div className="relative">
        <Avatar initials={friend.initials} size="md" />
        {friend.status !== "offline" && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white ${
              friend.status === "training"
                ? "bg-amber-400 animate-pulse"
                : "bg-emerald-400"
            }`}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-ink-900 dark:text-white">
            {friend.name}
          </p>
          <StatusDot status={friend.status} />
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-500 dark:text-ink-400">
          <span>{friend.vertical}</span>
          <span className="flex items-center gap-0.5">
            <Flame className="size-3 text-ink-400 dark:text-ink-500" />
            {friend.streak}d
          </span>
          <span>{friend.totalReps} reps</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="brand-gradient-text text-xl font-extrabold tabular-nums">
          {friend.composite}
        </span>
        <DeltaBadge delta={friend.weeklyDelta} />
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          disabled
          className="rounded-lg border border-ink-200 p-1.5 text-ink-300 dark:border-ink-700 dark:text-ink-600"
          title="Challenge (preview)"
          aria-label="Challenge this friend (preview — coming soon)"
        >
          <Swords className="size-3.5" />
        </button>
        <button
          type="button"
          disabled
          className="inline-flex rounded-lg border border-ink-200 p-1.5 text-ink-300 dark:border-ink-700 dark:text-ink-600"
          title="Message (preview)"
          aria-label="Message this friend (preview — coming soon)"
        >
          <MessageCircle className="size-3.5" />
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-ink-200 p-1.5 text-ink-300 dark:border-ink-700 dark:text-ink-600"
          title="View profile (preview)"
          aria-label="View this friend's profile (preview — coming soon)"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function MockChallengeCard({ challenge }: { challenge: Challenge }) {
  const statusColors = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    active: "bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-brand-lavender",
    completed: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
  } as const;

  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColors[challenge.status]}`}
        >
          {challenge.status === "pending"
            ? "Your turn"
            : challenge.status === "active"
              ? "In progress"
              : "Completed"}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-ink-400 dark:text-ink-500">
          <Clock className="size-3" />
          {challenge.expiresAt}
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-ink-700 dark:text-ink-200">
        &ldquo;{challenge.prompt}&rdquo;
      </p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-600 dark:text-ink-300">
        <span>
          {challenge.challengerName}:{" "}
          <strong className="brand-gradient-text text-sm tabular-nums">
            {challenge.challengerScore ?? "—"}
          </strong>
        </span>
        <span className="text-xs font-black text-ink-300 dark:text-ink-600">VS</span>
        <span>
          {challenge.opponentName}:{" "}
          <strong className="brand-gradient-text text-sm tabular-nums">
            {challenge.opponentScore ?? "—"}
          </strong>
        </span>
      </div>
    </div>
  );
}

// ——— Shared ————————————————————————————————————————————————

function QuickStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <div className="brand-gradient grid size-9 shrink-0 place-items-center rounded-lg text-white">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          {label}
        </p>
        <p className="text-lg font-extrabold text-ink-900 dark:text-white">{value}</p>
        {sub && <p className="text-[10px] text-ink-500 dark:text-ink-400">{sub}</p>}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: FriendProfile["status"] }) {
  const colors = {
    online: "bg-emerald-400",
    training: "bg-amber-400 animate-pulse",
    offline: "bg-ink-300 dark:bg-ink-600",
  };
  const labels = {
    online: "Online",
    training: "Training now",
    offline: "Offline",
  };
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-ink-500 dark:text-ink-400">
      <span className={`inline-block size-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
        <TrendingUp className="size-3" />+{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500">
        <TrendingDown className="size-3" />
        {delta}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-ink-400 dark:text-ink-500">
      <Minus className="size-3" />0
    </span>
  );
}

function ActivityRow({ activity }: { activity: FriendActivity }) {
  const icons: Record<FriendActivity["type"], React.ReactNode> = {
    workout_complete: <Flame className="size-3.5 text-orange-500" />,
    streak_milestone: <Flame className="size-3.5 text-brand-purple dark:text-brand-lavender" />,
    new_high: <Trophy className="size-3.5 text-amber-500" />,
    challenge_win: <Swords className="size-3.5 text-emerald-500" />,
    joined: <UserPlus className="size-3.5 text-blue-500" />,
  };

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800">
      <Avatar initials={activity.friendInitials} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {icons[activity.type]}
          <span className="text-xs font-semibold text-ink-800 dark:text-ink-100">
            {activity.friendName}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-600 dark:text-ink-300">{activity.description}</p>
      </div>
      <span className="shrink-0 text-[10px] text-ink-400 dark:text-ink-500">
        {activity.timestamp}
      </span>
    </div>
  );
}

// ——— Helpers ——————————————————————————————————————————————
// `Avatar`, `initials`, and `relativeTime` now live in the shared
// `ActivityFeedRow` module and are imported at the top of this file.
