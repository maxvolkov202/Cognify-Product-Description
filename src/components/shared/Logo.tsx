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
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo/mark.png"
        alt=""
        aria-hidden="true"
        width={256}
        height={256}
        priority
        quality={100}
        sizes={`${size}px`}
        className="shrink-0"
        style={{ width: size, height: size }}
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
    <Link href={href} aria-label="Cognify home" className="inline-flex">
      {content}
    </Link>
  );
}
