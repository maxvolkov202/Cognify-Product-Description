import Link from "next/link";
import { Logo } from "./Logo";

const groups = [
  {
    title: "Product",
    links: [
      { href: "/product", label: "Product" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/use-cases", label: "Use cases" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "For",
    links: [
      { href: "/for-teams", label: "Teams" },
      { href: "/for-teams#career-centers", label: "Career centers" },
      { href: "/for-individuals", label: "Individuals" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/about/team", label: "Team & advisors" },
      { href: "/help", label: "Help & support" },
      { href: "/help#contact", label: "Contact" },
      { href: "/about/references", label: "Research" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-ink-200/80 bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-ink-500">
            A communication training gym. Train clear thinking into clear speech.
          </p>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              {group.title}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-600 transition-colors hover:text-ink-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-200/60">
        <p className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-ink-500">
          © 2026 Cognify. A communication training gym. One rep closer to clarity.
        </p>
      </div>
    </footer>
  );
}
