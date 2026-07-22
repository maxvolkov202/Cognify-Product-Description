"use client";

import { useState } from "react";
import Image from "next/image";
import { PlayCircle } from "lucide-react";

type Props = {
  src: string;
  isVideo: boolean;
  kindLabel: string;
  /** Shown in the fallback when the poster image fails to load. */
  title: string;
};

/**
 * Library card poster. Renders the (unoptimized, remote) thumbnail image and,
 * critically, swaps to a branded typographic fallback if that image errors —
 * e.g. a YouTube `hqdefault.jpg` that 404s for a removed/private video. Without
 * this, a failed `<Image>` left the bare `bg-ink-900` container showing as a
 * solid black box.
 */
export function LibraryPoster({ src, isVideo, kindLabel, title }: Props) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="brand-gradient relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden p-5 text-center">
        <div
          className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/15 blur-2xl"
          aria-hidden="true"
        />
        <p className="relative line-clamp-3 text-sm font-extrabold leading-snug tracking-tight text-white drop-shadow-sm md:text-base">
          {title}
        </p>
        {isVideo && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <PlayCircle
              className="size-12 text-white/90 drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
              strokeWidth={1.5}
            />
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
            {kindLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-ink-700 to-ink-900">
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        unoptimized
        onError={() => setErrored(true)}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent"
        aria-hidden="true"
      />
      {isVideo && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <PlayCircle
            className="size-14 text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
            strokeWidth={1.5}
          />
        </div>
      )}
      <div className="absolute left-3 top-3 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
          {kindLabel}
        </span>
      </div>
    </div>
  );
}
