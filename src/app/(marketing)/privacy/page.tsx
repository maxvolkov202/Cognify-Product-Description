import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Cognify",
  description:
    "How Cognify collects, uses, and protects your data when you train your communication.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
        Legal
      </p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-ink-500">
        Last updated: April 2026. This is a plain-language summary. The full legal policy is available on request.
      </p>

      <section className="mt-10 space-y-8 text-ink-700">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            What we collect
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li>
              <strong>Account info:</strong> your email, name (optional), and
              profile image (if you sign in with Google).
            </li>
            <li>
              <strong>Practice data:</strong> the audio you record for reps,
              transcripts generated from that audio, scores, and feedback.
            </li>
            <li>
              <strong>Onboarding answers:</strong> your vertical (sales,
              consulting, etc.), personas you speak to, and improvement goals.
              Used to personalize your workouts.
            </li>
            <li>
              <strong>Usage signals:</strong> reps completed, scores over time,
              streak days, which features you use.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            What we don&apos;t do
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li>
              We don&apos;t sell your data to advertisers or third parties.
            </li>
            <li>
              We don&apos;t train our AI models on your audio or transcripts.
              Your reps stay yours.
            </li>
            <li>
              We don&apos;t share your individual scores or transcripts with
              anyone, not even team admins, unless you explicitly share them.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            Who processes your data
          </h2>
          <p className="mt-2 leading-relaxed">
            We use a small number of third-party services to run Cognify:
            Supabase (database, auth, file storage), Anthropic (Claude, for scoring and feedback), Deepgram (speech-to-text), Vercel (hosting), Resend
            (email). Each of these has its own privacy policy and processes only
            the data required to perform its job. We don&apos;t share more than
            we need to.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">Your rights</h2>
          <p className="mt-2 leading-relaxed">
            You can request a copy of your data, ask us to delete your account,
            or opt out of optional processing at any time. Email{" "}
            <a
              href="mailto:support@cognifygym.com"
              className="font-semibold text-brand-purple hover:underline"
            >
              support@cognifygym.com
            </a>{" "}
            and we&apos;ll handle it within 30 days.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">Cookies</h2>
          <p className="mt-2 leading-relaxed">
            We use a single cookie (<code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">cognify_guest_id</code>)
            to remember you across pages, plus Supabase&apos;s auth session
            cookies when you&apos;re signed in. No third-party trackers.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">Changes</h2>
          <p className="mt-2 leading-relaxed">
            If we materially change this policy, we&apos;ll notify active users
            by email and update the &quot;Last updated&quot; date above.
          </p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
          <p className="text-sm leading-relaxed text-ink-700">
            Questions? Reply to any email we send you, or reach out via the{" "}
            <Link
              href="/help"
              className="font-semibold text-brand-purple hover:underline"
            >
              help page
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
