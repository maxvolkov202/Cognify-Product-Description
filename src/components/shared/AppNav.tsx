"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { LoginDialog } from "./LoginDialog";
import { GuardedLink } from "./GuardedLink";

type NavItem = { href: string; label: string; primary?: boolean };

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

/** Active when the pathname is the link target or nested under it
 *  (e.g. /build-a-rep/abc highlights "Build a Rep"). */
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * App-surface header. Includes a responsive hamburger menu for mobile
 * since the full nav doesn't fit on narrow viewports.
 */
export function AppNav({ navItems, sessionUser }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const moreRef = useRef<HTMLDivElement>(null);

  // Split into inline desktop tabs vs. the "More" dropdown group.
  const primaryItems = navItems.filter((item) => item.primary);
  const moreItems = navItems.filter((item) => !item.primary);
  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  // Close the "More" dropdown on outside click, Escape, or route change.
  useEffect(() => {
    if (!moreOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/95 backdrop-blur-md dark:border-ink-700/70 dark:bg-ink-900/95">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <nav
            aria-label="App"
            className="hidden items-center gap-x-5 gap-y-1 md:flex"
          >
            {primaryItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <GuardedLink
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "relative whitespace-nowrap text-[13px] font-bold text-ink-900 dark:text-white"
                      : "whitespace-nowrap text-[13px] font-semibold text-ink-600 transition-colors hover:text-ink-900 dark:text-ink-300 dark:hover:text-white"
                  }
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 -bottom-1.5 h-0.5 rounded-full brand-gradient"
                    />
                  )}
                </GuardedLink>
              );
            })}

            {moreItems.length > 0 && (
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  className={
                    moreActive || moreOpen
                      ? "relative flex items-center gap-1 whitespace-nowrap text-[13px] font-bold text-ink-900 dark:text-white"
                      : "flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-ink-600 transition-colors hover:text-ink-900 dark:text-ink-300 dark:hover:text-white"
                  }
                >
                  More
                  <ChevronDown
                    className={`size-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                    strokeWidth={2.5}
                  />
                  {moreActive && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 -bottom-1.5 h-0.5 rounded-full brand-gradient"
                    />
                  )}
                </button>

                {moreOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-40 mt-3 min-w-[11rem] overflow-hidden rounded-2xl border border-ink-200/80 bg-white p-1.5 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.35)] dark:border-ink-700/80 dark:bg-ink-900"
                  >
                    {moreItems.map((item) => {
                      const active = isActive(pathname, item.href);
                      return (
                        <GuardedLink
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setMoreOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={
                            active
                              ? "block rounded-xl bg-ink-50 px-3 py-2 text-[13px] font-bold text-ink-900 dark:bg-ink-800 dark:text-white"
                              : "block rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
                          }
                        >
                          {item.label}
                        </GuardedLink>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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
                  className="min-h-[44px] rounded-full border border-ink-200 bg-white px-4 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600 dark:hover:bg-ink-800"
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
            className="grid size-11 place-items-center rounded-full border border-ink-200 bg-white text-ink-700 hover:border-ink-300 md:hidden dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600"
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
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <GuardedLink
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "block rounded-lg bg-ink-50 px-2 py-2.5 text-sm font-bold text-ink-900 dark:bg-ink-800 dark:text-white"
                        : "block rounded-lg px-2 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
                    }
                  >
                    {item.label}
                  </GuardedLink>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
