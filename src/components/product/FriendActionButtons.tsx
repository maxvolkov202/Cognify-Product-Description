"use client";

import { useState, useTransition } from "react";
import {
  acceptFriendRequestAction,
  declineFriendRequestAction,
} from "@/server/actions/friends";

export function AcceptDeclineButtons({
  friendshipId,
}: {
  friendshipId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  if (done === "accepted") {
    return (
      <span className="rounded-lg bg-success/10 px-3 py-1 text-xs font-semibold text-success">
        Accepted
      </span>
    );
  }
  if (done === "declined") {
    return (
      <span className="rounded-lg bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-500">
        Declined
      </span>
    );
  }

  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptFriendRequestAction(friendshipId);
            if (result.ok) setDone("accepted");
          })
        }
        className="brand-gradient rounded-lg px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
      >
        Accept
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await declineFriendRequestAction(friendshipId);
            if (result.ok) setDone("declined");
          })
        }
        className="rounded-lg border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-500 hover:bg-ink-50 disabled:opacity-40"
      >
        Decline
      </button>
    </div>
  );
}
