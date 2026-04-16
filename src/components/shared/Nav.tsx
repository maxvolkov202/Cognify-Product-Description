import Link from "next/link";
import { Logo } from "./Logo";
import { GradientButton } from "./GradientButton";
import { LoginDialog } from "./LoginDialog";

const links = [
  { href: "/product", label: "Product" },
  { href: "/for-teams", label: "For Teams" },
  { href: "/for-individuals", label: "For Individuals" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <LoginDialog />
          </div>
          <GradientButton href="/dashboard" size="sm">
            Enter the gym →
          </GradientButton>
        </div>
      </div>
    </header>
  );
}
