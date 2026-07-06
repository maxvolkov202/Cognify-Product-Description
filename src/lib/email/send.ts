import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? "Cognify <onboarding@resend.dev>";
const SUPPORT_INBOX = process.env.SUPPORT_INBOX ?? "support@cognifygym.com";

export async function sendWelcomeEmail(to: string, name: string | null) {
  if (!resend) {
    console.log("[email] RESEND_API_KEY not set — skipping welcome email to", to);
    return;
  }

  const firstName = name?.split(" ")[0] ?? "there";

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Welcome to Cognify, ${firstName}`,
      html: buildWelcomeHtml(firstName),
    });
  } catch (err) {
    console.error("[email] failed to send welcome email:", err);
  }
}

export type SupportRequest = {
  fromEmail: string;
  fromName: string | null;
  topic: string;
  message: string;
};

export type SupportResult =
  | { ok: true }
  | { ok: false; reason: "missing_key" | "send_failed"; detail?: string };

export async function sendSupportRequest(
  req: SupportRequest,
): Promise<SupportResult> {
  if (!resend) {
    console.log(
      "[email] RESEND_API_KEY not set — logging support request instead:",
      req,
    );
    return { ok: false, reason: "missing_key" };
  }
  try {
    await resend.emails.send({
      from: FROM,
      to: SUPPORT_INBOX,
      replyTo: req.fromEmail,
      subject: `[Cognify support] ${req.topic}`,
      html: buildSupportHtml(req),
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] failed to send support request:", err);
    return {
      ok: false,
      reason: "send_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export type CrewInviteEmail = {
  to: string;
  inviterName: string | null;
  inviteUrl: string;
};

export async function sendCrewInviteEmail(opts: CrewInviteEmail): Promise<void> {
  if (!resend) {
    console.log(
      "[email] RESEND_API_KEY not set, skipping crew invite to",
      opts.to,
    );
    return;
  }
  const inviter = opts.inviterName?.split(" ")[0] ?? "A friend";
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `${inviter} invited you to their Cognify gym crew`,
      html: buildCrewInviteHtml(inviter, opts.inviteUrl),
    });
  } catch (err) {
    console.error("[email] failed to send crew invite:", err);
  }
}

// PRD v3 Phase 6.8 — committed-day reminder ("streak at risk"). Sent by
// /api/cron/committed-day-reminder in the user's local early evening
// when a committed training day has no session yet. Opt-out via
// users.reminder_emails_enabled (Settings).
export type CommittedDayReminderEmail = {
  to: string;
  name: string | null;
  streakDays: number;
};

export async function sendCommittedDayReminderEmail(
  opts: CommittedDayReminderEmail,
): Promise<void> {
  if (!resend) {
    console.log(
      "[email] RESEND_API_KEY not set, skipping day reminder to",
      opts.to,
    );
    return;
  }
  const firstName = opts.name?.split(" ")[0] ?? "there";
  const subject =
    opts.streakDays >= 3
      ? `${firstName}, your ${opts.streakDays}-day streak is on the line`
      : `${firstName}, today's a training day`;
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject,
      html: buildDayReminderHtml(firstName, opts.streakDays),
    });
  } catch (err) {
    console.error("[email] failed to send day reminder:", err);
  }
}

function buildDayReminderHtml(firstName: string, streakDays: number): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cognifygym.com";
  const streakLine =
    streakDays >= 3
      ? `Your <strong style="color:#9788ff;">${streakDays}-day streak</strong> ends at midnight if today stays empty. One short session keeps it alive.`
      : `Today's one of your committed training days — and it's still open. Ten minutes is all a session takes.`;
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e5f0;">
    <div style="background:linear-gradient(135deg,#9788ff,#d946ef);padding:28px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
        ${streakDays >= 3 ? "🔥 Streak check" : "Time to train"}
      </h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;color:#1a1625;font-size:15px;line-height:1.6;">
        Hey ${escapeHtml(firstName)} — ${streakLine}
      </p>
      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${appUrl}/workout"
           style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#9788ff,#d946ef);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">
          Start today's workout →
        </a>
      </div>
      <p style="margin:20px 0 0;color:#9893a8;font-size:12px;text-align:center;line-height:1.6;">
        You chose your training days — this is just the nudge you asked for.<br/>
        Turn reminders off any time in <a href="${appUrl}/settings" style="color:#9788ff;">Settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

function buildCrewInviteHtml(inviter: string, inviteUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e5f0;">
    <div style="background:linear-gradient(135deg,#9788ff,#d946ef);padding:28px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
        ${escapeHtml(inviter)} wants you in their Cognify crew
      </h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;color:#1a1625;font-size:15px;line-height:1.6;">
        Cognify is the gym for communication. Short daily reps, AI feedback, six core skills measured every time.
      </p>
      <p style="margin:0 0 24px;color:#4a4458;font-size:14px;line-height:1.7;">
        Join the crew and you can both track progress, push each other on streaks, and run head to head challenges.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#9788ff,#d946ef);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">
          Accept invite and start training
        </a>
      </div>
      <p style="margin:24px 0 0;color:#9893a8;font-size:12px;text-align:center;">
        If the button does not work, paste this link into your browser:<br>
        <span style="color:#6b6480;word-break:break-all;">${escapeHtml(inviteUrl)}</span>
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

function buildSupportHtml(req: SupportRequest): string {
  const safeMessage = escapeHtml(req.message).replace(/\n/g, "<br>");
  return `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;color:#1a1625;">New support request</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr><td style="padding:6px 0;color:#6b6480;width:120px;">Topic</td><td style="padding:6px 0;color:#1a1625;font-weight:600;">${escapeHtml(req.topic)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b6480;">From</td><td style="padding:6px 0;color:#1a1625;">${escapeHtml(req.fromName ?? "")} &lt;${escapeHtml(req.fromEmail)}&gt;</td></tr>
  </table>
  <div style="padding:16px;background:#f8f7fa;border-radius:12px;color:#1a1625;line-height:1.6;">${safeMessage}</div>
  <p style="margin:24px 0 0;color:#9893a8;font-size:12px;">Reply directly to this email to respond.</p>
</body>
</html>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildWelcomeHtml(firstName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e5f0;">
    <div style="background:linear-gradient(135deg,#9788ff,#d946ef);padding:32px 28px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
        Welcome to Cognify
      </h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
        Your communication gym is ready.
      </p>
    </div>
    <div style="padding:32px 28px;">
      <p style="margin:0 0 16px;color:#1a1625;font-size:15px;line-height:1.6;">
        Hey ${firstName},
      </p>
      <p style="margin:0 0 16px;color:#4a4458;font-size:14px;line-height:1.7;">
        You just joined the gym where communication is the skill and reps are the method.
        Every rep is scored by AI across six Core Skills — four for <strong>what you say</strong>
        (clarity, structure, conciseness, thinking quality) and two for <strong>how you say it</strong>
        (pacing, tone).
      </p>
      <p style="margin:0 0 24px;color:#4a4458;font-size:14px;line-height:1.7;">
        Here's how to start:
      </p>

      <div style="margin:0 0 12px;padding:16px;background:#f8f7fa;border-radius:12px;">
        <p style="margin:0;font-size:13px;">
          <strong style="color:#9788ff;">1. Daily Workout</strong>
          <span style="color:#4a4458;"> — 10 minutes, 4 reps, instant feedback. Build the habit.</span>
        </p>
      </div>
      <div style="margin:0 0 12px;padding:16px;background:#f8f7fa;border-radius:12px;">
        <p style="margin:0;font-size:13px;">
          <strong style="color:#9788ff;">2. Build a Rep</strong>
          <span style="color:#4a4458;"> — Describe a real moment you're preparing for. Get a structure. Practice it.</span>
        </p>
      </div>
      <div style="margin:0 0 24px;padding:16px;background:#f8f7fa;border-radius:12px;">
        <p style="margin:0;font-size:13px;">
          <strong style="color:#9788ff;">3. Challenge a friend</strong>
          <span style="color:#4a4458;"> — Same prompt, head-to-head scoring. See who communicates better.</span>
        </p>
      </div>

      <div style="text-align:center;margin:28px 0 16px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://cognifygym.com"}/workout"
           style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#9788ff,#d946ef);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">
          Start your first workout →
        </a>
      </div>

      <p style="margin:24px 0 0;color:#9893a8;font-size:12px;text-align:center;line-height:1.6;">
        Cognify scores every rep with AI grounded in research-backed speech frameworks.
        The more you train, the sharper you get.
      </p>
    </div>
    <div style="padding:20px 28px;border-top:1px solid #e8e5f0;text-align:center;">
      <p style="margin:0;color:#b5b0c3;font-size:11px;">
        Cognify · Communication training, measured.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}
