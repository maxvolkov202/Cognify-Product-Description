import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type LogoProps = {
  variant?: "mark" | "full";
  className?: string;
  href?: string;
};

export function Logo({ variant = "full", className, href = "/" }: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="brand-gradient relative grid size-8 place-items-center rounded-[10px] shadow-[0_2px_8px_-2px_rgba(151,136,255,0.5)]"
      >
        <BrainDumbbell className="size-5 text-[#fdf7e4]" />
      </span>
      {variant === "full" && (
        <span className="text-[21px] font-extrabold tracking-tight text-ink-900">
          Cognify
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} aria-label="Cognify home" className="inline-flex">
      {content}
    </Link>
  );
}

function BrainDumbbell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7.2 7.4c-1.1 0-2 1-2 2.2 0 .6.2 1 .6 1.4-.6.4-1 1-1 1.8 0 1.4 1 2.4 2.4 2.4.6 0 1.2-.2 1.6-.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.8 7.4c1.1 0 2 1 2 2.2 0 .6-.2 1-.6 1.4.6.4 1 1 1 1.8 0 1.4-1 2.4-2.4 2.4-.6 0-1.2-.2-1.6-.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 6.8c.8-1 1.8-1.4 2.8-1.4s2 .4 2.8 1.4M9 17.2c.8 1 1.8 1.4 2.8 1.4s2-.4 2.8-1.4M11.9 5.4v13.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="9" y="11" width="6" height="2.4" rx="0.4" fill="currentColor" />
      <rect x="8" y="10" width="1" height="4.4" rx="0.3" fill="currentColor" />
      <rect x="15" y="10" width="1" height="4.4" rx="0.3" fill="currentColor" />
    </svg>
  );
}
