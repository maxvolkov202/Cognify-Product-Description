"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { LoginDialog } from "./LoginDialog";
import { GuardedLink } from "./GuardedLink";

type NavItem = { href: string; label: string };

type SessionUser = {
  name: string | null;
  email: string | null;
  image: string | null;
  isOperator: boolean;
};

type Props = {
  navItems: readonly NavItem[];
  sessionUser: SessionUser | null;
};

/**
 * App-surface header. Includes a responsive hamburger menu for mobile
 * since the full nav doesn't fit on narrow viewports.
 */
export function AppNav({ navItems, sessionUser }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/95 backdrop-blur-md dark:border-ink-700/70 dark:bg-ink-900/95">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <nav
            aria-label="App"
            className="hidden items-center gap-x-5 gap-y-1 md:flex"
          >
            {navItems.map((item) => (
              <GuardedLink
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-[13px] font-semibold text-ink-600 transition-colors hover:text-ink-900 dark:text-ink-300 dark:hover:text-white"
              >
                {item.label}
              </GuardedLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {sessionUser ? (
            <UserMenu
              name={sessionUser.name}
              email={sessionUser.email}
              image={sessionUser.image}
              isOperator={sessionUser.isOperator}
            />
          ) : (
            <LoginDialog
              trigger={
                <button
                  type="button"
                  className="rounded-full border border-ink-200 bg-white px-4 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600 dark:hover:bg-ink-800"
                >
                  Sign in
                </button>
              }
            />
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="grid size-10 place-items-center rounded-full border border-ink-200 bg-white text-ink-700 hover:border-ink-300 md:hidden dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          aria-label="Mobile app"
          className="border-t border-ink-200/60 bg-white md:hidden dark:border-ink-700/60 dark:bg-ink-900"
        >
          <ul className="mx-auto flex w-full max-w-6xl flex-col px-6 py-3">
            {navItems.map((item) => (
              <li key={item.href}>
                <GuardedLink
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-2 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
                >
                  {item.label}
                </GuardedLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
