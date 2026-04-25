"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type AnchorHTMLAttributes, type ReactNode, type MouseEvent } from "react";
import { useSettingsDirty } from "@/components/product/SettingsDirtyContext";

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">;

/**
 * Drop-in replacement for next/link's Link that consults the
 * SettingsDirtyContext before navigating. If the user has unsaved
 * preferences, the leave-prompt modal opens; we only navigate after
 * the user resolves it (Save / Discard / Stay).
 */
export function GuardedLink({ href, children, onClick, ...rest }: Props) {
  const router = useRouter();
  const ctx = useSettingsDirty();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.();
    if (!ctx?.isDirty) return; // let Link handle it
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      (e.button !== undefined && e.button !== 0)
    ) {
      return;
    }
    e.preventDefault();
    void ctx.guardNavigation(href).then((ok) => {
      if (ok) router.push(href);
    });
  }

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
