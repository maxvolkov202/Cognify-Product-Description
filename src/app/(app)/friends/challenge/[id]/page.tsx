import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Swords, Trophy, Clock } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { db } from "@/lib/db/client";
import { friendChallenges, users, reps } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { ChallengeRunner } from "@/components/product/ChallengeRunner";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ChallengeDetailPage({ params }: Props) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) notFound();

  const challenge = await safeDb(async () => {
    const row = await db.query.friendChallenges.findFirst({
      where: eq(friendChallenges.id, id),
    });
    return row ?? null;
  }, null);
  if (!challenge) notFound();

  const isChallenger = challenge.challengerId === me.id;
  const isOpponent = challenge.opponentId === me.id;
  if (!isChallenger && !isOpponent) notFound();

  const otherId = isChallenger ? challenge.opponentId : challenge.challengerId;
  const other = await safeDb(
    async () => db.query.users.findFirst({ where: eq(users.id, otherId) }),
    null,
  );

  const [challengerRep, opponentRep] = await Promise.all([
    challenge.challengerRepId
      ? safeDb(
          async () =>
            db.query.reps.findFirst({
              where: eq(reps.id, challenge.challengerRepId!),
            }),
          null,
        )
      : Promise.resolve(null),
    challenge.opponentRepId
      ? safeDb(
          async () =>
            db.query.reps.findFirst({
              where: eq(reps.id, challenge.opponentRepId!),
            }),
          null,
        )
      : Promise.resolve(null),
  ]);

  const myRepId = isChallenger
    ? challenge.challengerRepId
    : challenge.opponentRepId;
  const theirRepId = isChallenger
    ? challenge.opponentRepId
    : challenge.challengerRepId;

  const iHaveRecorded = !!myRepId;
  const theyHaveRecorded = !!theirRepId;
  const completed = challenge.status === "completed";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <Link
        href="/friends"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" />
        Back to friends
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl shadow-sm">
          <Swords
            className="size-5 text-white"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Head-to-head challenge · {statusLabel(challenge.status)}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
            vs. {other?.name ?? "your friend"}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Same prompt, same rubric, side-by-side scoring.
          </p>
        </div>
      </div>

      <div className="mt-6 surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            The prompt
          </p>
          <p className="mt-1 text-lg font-bold text-ink-900">
            &ldquo;{challenge.prompt}&rdquo;
          </p>
          {challenge.expiresAt && !completed && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-500">
              <Clock className="size-3" />
              Expires {challenge.expiresAt.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {completed ? (
        <ResultsPanel
          yourScore={(isChallenger ? challengerRep : opponentRep)?.compositeScore ?? null}
          theirScore={(isChallenger ? opponentRep : challengerRep)?.compositeScore ?? null}
          theirName={other?.name ?? "Friend"}
          yourRepScore={
            (isChallenger ? challengerRep : opponentRep)?.compositeScore ?? null
          }
        />
      ) : iHaveRecorded ? (
        <WaitingPanel
          theirName={other?.name ?? "your friend"}
          theyHaveRecorded={theyHaveRecorded}
        />
      ) : (
        <ChallengeRunner
          challengeId={challenge.id}
          prompt={challenge.prompt}
          opponentName={other?.name ?? "your friend"}
        />
      )}
    </div>
  );
}

function statusLabel(s: string): string {
  if (s === "pending") return "waiting for one of you";
  if (s === "active") return "in progress";
  if (s === "completed") return "finished";
  return s;
}

function WaitingPanel({
  theirName,
  theyHaveRecorded,
}: {
  theirName: string;
  theyHaveRecorded: boolean;
}) {
  return (
    <div className="mt-6 surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-8 text-center">
        <Clock className="mx-auto size-8 text-brand-purple" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-extrabold text-ink-900">
          {theyHaveRecorded
            ? "Both reps are in — scoring now."
            : `Waiting on ${theirName} to record.`}
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          {theyHaveRecorded
            ? "Results will appear here once scoring finishes. Refresh in a moment."
            : "You'll get a notification when they complete their rep. This page auto-updates on refresh."}
        </p>
      </div>
    </div>
  );
}

function ResultsPanel({
  yourScore,
  theirScore,
  theirName,
}: {
  yourScore: number | null;
  theirScore: number | null;
  theirName: string;
  yourRepScore: number | null;
}) {
  const y = yourScore ?? 0;
  const t = theirScore ?? 0;
  const won = y > t;
  const tied = y === t;

  return (
    <div className="mt-6 surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-8">
        <div className="flex flex-col items-center gap-3">
          <Trophy
            className={`size-10 ${won ? "text-amber-500" : tied ? "text-ink-400" : "text-ink-300"}`}
            aria-hidden="true"
          />
          <p className="text-center text-2xl font-extrabold text-ink-900">
            {won ? "You won." : tied ? "It's a tie." : `${theirName} won this round.`}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
          <ScoreColumn label="You" score={yourScore} highlight={won} />
          <span className="text-3xl font-black text-ink-300">VS</span>
          <ScoreColumn label={theirName} score={theirScore} highlight={!won && !tied} />
        </div>

        <div className="mt-8 border-t border-ink-100 pt-4 text-center text-xs text-ink-500">
          Challenge complete. Run another from{" "}
          <Link
            href="/friends"
            className="font-semibold text-brand-purple hover:underline"
          >
            Friends
          </Link>
          .
        </div>
      </div>
    </div>
  );
}

function ScoreColumn({
  label,
  score,
  highlight,
}: {
  label: string;
  score: number | null;
  highlight: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </p>
      <p
        className={`text-5xl font-extrabold tabular-nums ${
          highlight ? "brand-gradient-text" : "text-ink-300"
        }`}
      >
        {score ?? "—"}
      </p>
      <p className="text-[10px] text-ink-400">composite</p>
    </div>
  );
}

