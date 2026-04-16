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
    "border border-ink-300 text-ink-900 hover:border-ink-500 hover:bg-ink-50 transition-colors",
  ghost: "text-ink-700 hover:bg-ink-100 transition-colors",
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
    "focus-visible:ring-2 focus-visible:ring-offset-2",
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
