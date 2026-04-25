import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type LogoProps = {
  variant?: "mark" | "full";
  className?: string;
  href?: string;
};

export function Logo({ variant = "full", className, href = "/" }: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo/mark.svg"
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        priority
        className="size-8 rounded-[10px]"
      />
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
