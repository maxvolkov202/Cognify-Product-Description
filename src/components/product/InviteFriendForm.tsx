"use client";

import { useState, useTransition } from "react";
import { UserPlus, CheckCircle2, AlertTriangle } from "lucide-react";
import { sendFriendRequestAction } from "@/server/actions/friends";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  not_found:
    "No one with that email is on Cognify yet. Send them an invite to sign up.",
  already_friends: "You're already friends.",
  request_exists: "A request between you already exists.",
  self_request: "That's your own email.",
  invalid_input: "Enter a valid email address.",
  db_unavailable: "Database unavailable — try again shortly.",
  no_user: "You need to be signed in.",
};

export function InviteFriendForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting" || isPending) return;
    setState({ kind: "submitting" });
    startTransition(async () => {
      const result = await sendFriendRequestAction(email);
      if (result.ok) {
        setState({ kind: "ok" });
        setEmail("");
      } else {
        setState({
          kind: "error",
          message: ERROR_MESSAGES[result.error] ?? "Couldn't send request.",
        });
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state.kind !== "idle") setState({ kind: "idle" });
        }}
        placeholder="friend@company.com"
        autoComplete="email"
        className="flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
      />
      <button
        type="submit"
        disabled={state.kind === "submitting" || isPending}
        className="brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        <UserPlus className="size-4" />
        {state.kind === "submitting" || isPending ? "Sending…" : "Send request"}
      </button>
      {state.kind === "ok" && !compact && (
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-xs font-semibold text-success">
          <CheckCircle2 className="size-3.5" /> Request sent.
        </span>
      )}
      {state.kind === "error" && !compact && (
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          <AlertTriangle className="size-3.5" /> {state.message}
        </span>
      )}
      {compact && state.kind !== "idle" && state.kind !== "submitting" && (
        <p
          className={`text-xs ${
            state.kind === "ok" ? "text-success" : "text-danger"
          }`}
        >
          {state.kind === "ok" ? "Sent." : state.message}
        </p>
      )}
    </form>
  );
}
