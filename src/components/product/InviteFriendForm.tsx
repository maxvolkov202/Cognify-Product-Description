"use client";

import { useState, useTransition } from "react";
import {
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { sendFriendRequestAction } from "@/server/actions/friends";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok_friend" }
  | { kind: "ok_invite"; email: string; inviteUrl: string }
  | { kind: "error"; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  already_friends: "You're already in the same crew.",
  request_exists: "A request between you already exists.",
  self_request: "That's your own email.",
  invalid_input: "Enter a valid email address.",
  db_unavailable: "Database unavailable, try again shortly.",
  no_user: "You need to be signed in.",
};

export function InviteFriendForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting" || isPending) return;
    setState({ kind: "submitting" });
    startTransition(async () => {
      const result = await sendFriendRequestAction(email);
      if (result.ok) {
        if (result.data.kind === "invite_sent") {
          setState({
            kind: "ok_invite",
            email: result.data.email,
            inviteUrl: result.data.inviteUrl,
          });
        } else {
          setState({ kind: "ok_friend" });
        }
        setEmail("");
      } else {
        setState({
          kind: "error",
          message: ERROR_MESSAGES[result.error] ?? "Couldn't send request.",
        });
      }
    });
  }

  function copyLink() {
    if (state.kind !== "ok_invite") return;
    void navigator.clipboard.writeText(state.inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state.kind !== "idle") setState({ kind: "idle" });
            setCopied(false);
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
          {state.kind === "submitting" || isPending ? "Sending…" : "Add to crew"}
        </button>
      </form>

      {state.kind === "ok_friend" && (
        <div className="inline-flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-xs font-semibold text-success">
          <CheckCircle2 className="size-3.5" />
          Request sent. They&rsquo;ll see it next time they sign in.
        </div>
      )}

      {state.kind === "ok_invite" && (
        <div className="rounded-2xl border border-brand-purple/20 bg-gradient-to-br from-brand-blue/5 via-white to-brand-magenta/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-purple">
            <Mail className="size-3.5" strokeWidth={2.5} />
            Invite emailed to {state.email}
          </div>
          <p className="mb-2 text-xs leading-relaxed text-ink-600">
            They&rsquo;ll get a Cognify invite. As soon as they sign up, they land in your crew. You can also share this link directly:
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white p-2">
            <input
              readOnly
              value={state.inviteUrl}
              className="flex-1 truncate bg-transparent text-[11px] text-ink-700 outline-none"
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-ink-700"
            >
              {copied ? (
                <>
                  <Check className="size-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3" /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {state.kind === "error" && !compact && (
        <div className="inline-flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          <AlertTriangle className="size-3.5" />
          {state.message}
        </div>
      )}
      {compact && state.kind === "error" && (
        <p className="text-xs text-danger">{state.message}</p>
      )}
    </div>
  );
}
