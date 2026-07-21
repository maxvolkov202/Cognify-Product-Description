import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type LogoProps = {
  variant?: "mark" | "full";
  className?: string;
  href?: string;
  /** Rendered pixel size of the mark. Default 36 for nav legibility. */
  size?: number;
};

export function Logo({
  variant = "full",
  className,
  href = "/",
  size = 36,
}: LogoProps) {
  // Use the detailed brand mark (matches the app icon / PWA icons) so the
  // logo is consistent everywhere it renders — nav, footer, loading, etc.
  // next/image optimizes + resizes the 1024px source down to the rendered
  // size, so the payload stays tiny despite the large master asset.
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo/mark.png"
        alt={variant === "mark" ? "Cognify" : ""}
        aria-hidden={variant === "full" ? "true" : undefined}
        width={size}
        height={size}
        priority
        className="shrink-0"
      />
      {variant === "full" && (
        <span className="text-[21px] font-extrabold tracking-tight text-ink-900 dark:text-white">
          Cognify
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} aria-label="Cognify home" className="inline-flex min-h-[44px] items-center">
      {content}
    </Link>
  );
}
