import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

type GradientButtonProps = {
  href?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-8 text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "brand-gradient text-white shadow-[0_8px_24px_-8px_rgba(151,136,255,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(151,136,255,0.7)] transition-shadow",
  outline:
    "border border-ink-300 text-ink-900 hover:border-ink-500 hover:bg-ink-50 transition-colors dark:border-ink-600 dark:text-white dark:hover:border-ink-500 dark:hover:bg-ink-800",
  ghost: "text-ink-700 hover:bg-ink-100 transition-colors dark:text-ink-200 dark:hover:bg-ink-800",
};

export function GradientButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  onClick,
}: GradientButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-full font-semibold tracking-tight",
    // Explicit brand-purple ring color — Tailwind defaults to blue-500
    // which is off-brand AND invisible on the brand-gradient bg.
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-brand-purple/60 dark:focus-visible:ring-brand-lavender/70",
    sizes[size],
    variants[variant],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
