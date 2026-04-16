import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · Cognify",
  description: "The rules for using Cognify, in plain English.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
        Legal
      </p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-ink-500">
        Last updated: April 2026.
      </p>

      <section className="mt-10 space-y-8 text-ink-700">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            What Cognify is
          </h2>
          <p className="mt-2 leading-relaxed">
            Cognify is a communication training platform. You record short
            speaking reps; we score them and give you feedback. Your progress
            is yours. You own what you record.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">Your account</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li>You must be at least 13 years old to use Cognify.</li>
            <li>
              You&apos;re responsible for what you record and for keeping your
              account credentials private.
            </li>
            <li>
              One account per person. Don&apos;t share logins or try to game
              the scoring system.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">What you can do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li>
              Use Cognify for personal communication training — practice,
              review your reps, track progress.
            </li>
            <li>
              Share your scores or individual reps with whoever you want. That
              data is yours.
            </li>
            <li>
              Export your data at any time (email{" "}
              <a
                href="mailto:support@cognifygym.com"
                className="font-semibold text-brand-purple hover:underline"
              >
                support@cognifygym.com
              </a>
              ).
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            What you can&apos;t do
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li>
              Don&apos;t record other people without their consent. Cognify
              reps are meant to be your own practice audio.
            </li>
            <li>
              Don&apos;t use the platform to harass, threaten, or impersonate
              anyone.
            </li>
            <li>
              Don&apos;t scrape, reverse-engineer, or attempt to extract data
              from other users&apos; reps.
            </li>
            <li>
              Don&apos;t abuse the scoring or API endpoints (rate limits are in
              place; repeated abuse = suspension).
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            Our obligations
          </h2>
          <p className="mt-2 leading-relaxed">
            We&apos;ll keep your data secure, keep the service running as best
            we can, and give you reasonable notice of material changes. If we
            ever shut down, we&apos;ll give you 30 days to export your data
            first. Service is provided &quot;as is&quot; — we don&apos;t
            guarantee scoring accuracy for any specific use case.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">Payments</h2>
          <p className="mt-2 leading-relaxed">
            Free tier is free. Paid plans (when launched) will have clear
            pricing at{" "}
            <Link
              href="/pricing"
              className="font-semibold text-brand-purple hover:underline"
            >
              /pricing
            </Link>
            . Cancel anytime; refunds are handled case-by-case — email support.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            Termination
          </h2>
          <p className="mt-2 leading-relaxed">
            You can delete your account anytime. We can suspend accounts that
            violate these terms, but we&apos;ll warn you first when possible
            and give you a chance to export your data.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-900">Changes</h2>
          <p className="mt-2 leading-relaxed">
            If we materially change these terms, we&apos;ll email active users
            and update the &quot;Last updated&quot; date. Continued use after
            changes means you accept the new terms.
          </p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
          <p className="text-sm leading-relaxed text-ink-700">
            Questions? Visit the{" "}
            <Link
              href="/help"
              className="font-semibold text-brand-purple hover:underline"
            >
              help page
            </Link>{" "}
            or email{" "}
            <a
              href="mailto:support@cognifygym.com"
              className="font-semibold text-brand-purple hover:underline"
            >
              support@cognifygym.com
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
