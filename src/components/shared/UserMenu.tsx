"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { signOut } from "next-auth/react";
import { LogOut, User, Activity, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Props = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isOperator?: boolean;
};

export function UserMenu({ name, email, image, isOperator }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-ink-200 bg-white pl-1 pr-3 py-1 text-sm font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
        >
          <Avatar name={name ?? email ?? "User"} image={image} />
          <span className="hidden max-w-[120px] truncate sm:inline">
            {name ?? email ?? "Account"}
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-200 bg-white p-6 shadow-2xl focus:outline-none">
          <Dialog.Title className="sr-only">Account</Dialog.Title>
          <div className="flex items-center gap-3">
            <Avatar name={name ?? email ?? "User"} image={image} size="lg" />
            <div className="min-w-0 flex-1">
              {name && <p className="truncate font-semibold text-ink-900">{name}</p>}
              {email && <p className="truncate text-sm text-ink-500">{email}</p>}
            </div>
          </div>
          <div className="mt-6 space-y-1 border-t border-ink-200 pt-4">
            <Link
              href="/help"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
            >
              <LifeBuoy className="size-4" />
              Help & support
            </Link>
            {isOperator && (
              <Link
                href="/ops"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-purple transition-colors hover:bg-brand-purple/5"
              >
                <Activity className="size-4" />
                Ops dashboard
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Avatar({
  name,
  image,
  size = "sm",
}: {
  name: string;
  image?: string | null;
  size?: "sm" | "lg";
}) {
  const dimension = size === "sm" ? "size-7" : "size-12";
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={`${dimension} rounded-full object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div
      className={`${dimension} brand-gradient grid place-items-center rounded-full text-xs font-bold text-white`}
      aria-hidden="true"
    >
      {initial || <User className="size-3.5" />}
    </div>
  );
}
