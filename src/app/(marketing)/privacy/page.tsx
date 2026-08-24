import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Cognify",
  description:
    "How Cognify collects, uses, and protects your data when you train your communication.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </div>
  );
}

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
        Last updated: August 2026. Written in plain language on purpose.
      </p>

      <section className="mt-10 space-y-8 text-ink-700">
        <Section title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Account info:</strong> your email, name (optional), and
              profile image (if you sign in with Google).
            </li>
            <li>
              <strong>Consent records:</strong> whether and when you agreed to
              the{" "}
              <Link
                href="/terms"
                className="font-semibold text-brand-purple hover:underline"
              >
                Terms &amp; Conditions
              </Link>{" "}
              and this policy at signup.
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
        </Section>

        <Section title="What we don't do">
          <ul className="list-disc space-y-1 pl-5">
            <li>We don&apos;t sell your data to advertisers or third parties.</li>
            <li>
              We don&apos;t train our AI models on your audio or transcripts.
              Your reps stay yours.
            </li>
            <li>
              We don&apos;t share your individual scores or transcripts with
              anyone, not even team admins, unless you explicitly share them.
            </li>
            <li>We don&apos;t use third-party ad trackers.</li>
          </ul>
        </Section>

        <Section title="How we use your data">
          <p>
            We use your data to run the product: transcribe and score your
            reps, generate feedback, track your progress, personalize your
            workouts, send service emails (welcome, reminders you opt into,
            account notices), keep the service secure, and fix bugs. That is
            the list. Legal bases where required: performing our contract with
            you, your consent (recorded at signup), and our legitimate interest
            in keeping the service secure and working.
          </p>
        </Section>

        <Section title="Who processes your data">
          <p>
            We use a small number of third-party processors to run Cognify:
            Supabase (database, auth, file storage), Anthropic (Claude, for
            scoring and feedback), OpenAI (scoring and embeddings), Deepgram
            (speech-to-text), Hume.ai (vocal prosody analysis for tone
            scoring), Vercel (hosting and analytics), Resend (email). Each has
            its own privacy policy and processes only the data required to
            perform its job. Some providers may process data in the United
            States or other countries; where they do, standard contractual
            safeguards apply.
          </p>
        </Section>

        <Section title="How long we keep things">
          <p>
            Account and progress data stay as long as your account exists.
            Rep audio is retained on a rolling window and cleaned up
            automatically; transcripts and scores persist so your history and
            progress charts keep working. When you delete your account we
            delete your personal data within 30 days, except minimal records
            we are legally required to keep (like consent timestamps and
            billing records, where applicable).
          </p>
        </Section>

        <Section title="Security">
          <p>
            Data is encrypted in transit and at rest by our infrastructure
            providers. Access to production data is restricted and
            credentialed. No system is perfectly secure; if we learn of a
            breach affecting your data we will notify you without undue delay.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can request a copy of your data, correct it, delete your
            account, or object to optional processing at any time. Depending
            on where you live (for example the EU/UK under GDPR or California
            under CCPA/CPRA) you may have additional statutory rights,
            including the right to lodge a complaint with your local
            supervisory authority. Email{" "}
            <a
              href="mailto:support@cognifygym.com"
              className="font-semibold text-brand-purple hover:underline"
            >
              support@cognifygym.com
            </a>{" "}
            and we&apos;ll handle any request within 30 days.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Cognify is not directed at children under 13, and we do not
            knowingly collect data from them. If you believe a child under 13
            has created an account, contact us and we will delete it.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use a small set of first-party cookies:{" "}
            <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">
              cognify_guest_id
            </code>{" "}
            (remembers you across pages before you sign up),{" "}
            <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">
              cognify_terms_accepted
            </code>{" "}
            (carries your signup consent timestamp to our server), and
            Supabase&apos;s auth session cookies when you&apos;re signed in. No
            third-party trackers.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If we materially change this policy, we&apos;ll notify active users
            by email and update the &quot;Last updated&quot; date above.
          </p>
        </Section>

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
