/**
 * Fallback hero for library cards that don't have an OG image or video
 * thumbnail. Renders the article's title in big serif type on a brand
 * gradient with a small favicon + source label — on-brand for a
 * communication product (show the words, not a generic book emoji).
 */
import Image from "next/image";

const SECTION_GRADIENTS: Record<string, string> = {
  speeches:
    "from-brand-blue/20 via-brand-lavender/20 to-brand-purple/20",
  executive:
    "from-brand-purple/15 via-brand-magenta/15 to-amber-200/40",
  negotiation:
    "from-amber-100 via-brand-magenta/15 to-brand-purple/20",
  structure:
    "from-emerald-200/40 via-brand-blue/15 to-brand-lavender/20",
  default:
    "from-brand-blue/15 via-brand-lavender/15 to-brand-magenta/15",
};

export function LibraryTypographicHero({
  title,
  source,
  faviconUrl,
  sectionId,
}: {
  title: string;
  source: string;
  faviconUrl: string | null;
  sectionId?: string;
}) {
  const gradient =
    (sectionId && SECTION_GRADIENTS[sectionId]) ?? SECTION_GRADIENTS.default;

  return (
    <div
      className={`relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br ${gradient}`}
    >
      <div className="absolute inset-0 flex items-end p-5 md:p-6">
        <p className="line-clamp-3 font-serif text-2xl font-bold leading-tight tracking-tight text-ink-900 md:text-3xl">
          &ldquo;{title}&rdquo;
        </p>
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-ink-200/60 bg-white/80 px-2 py-0.5 text-[10px] font-bold text-ink-700 backdrop-blur">
        {faviconUrl && (
          <Image
            src={faviconUrl}
            alt=""
            width={12}
            height={12}
            unoptimized
            className="size-3 rounded-sm"
          />
        )}
        <span className="line-clamp-1 max-w-[120px]">{source}</span>
      </div>
    </div>
  );
}
