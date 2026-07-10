import type { ApplicationId } from "@/types/application-skills";

/** Per-application accent identities — hue spread mirrors the skills-bar
 *  chips (the Cognify look is multi-hue inside one saturated family),
 *  with the brand lavender→fuchsia pair anchoring Persuasion. Extracted
 *  from the Skill Lab hub so session surfaces (Session Complete) carry
 *  the same identity. */
export type ApplicationAccent = {
  tile: string;
  glow: string;
  wash: string;
  chip: string;
  link: string;
  hoverBorder: string;
};

export const APPLICATION_ACCENTS: Record<ApplicationId, ApplicationAccent> = {
  storytelling: {
    tile: "from-violet-500 to-purple-600",
    glow: "shadow-violet-500/25",
    wash: "from-violet-50/80 to-transparent dark:from-violet-950/30",
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    link: "text-violet-600 dark:text-violet-400",
    hoverBorder: "hover:border-violet-300 dark:hover:border-violet-500/50",
  },
  presenting: {
    tile: "from-sky-500 to-blue-600",
    glow: "shadow-sky-500/25",
    wash: "from-sky-50/80 to-transparent dark:from-sky-950/30",
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    link: "text-sky-600 dark:text-sky-400",
    hoverBorder: "hover:border-sky-300 dark:hover:border-sky-500/50",
  },
  teaching: {
    tile: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/25",
    wash: "from-emerald-50/80 to-transparent dark:from-emerald-950/30",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    link: "text-emerald-600 dark:text-emerald-400",
    hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-500/50",
  },
  interviewing: {
    tile: "from-amber-500 to-orange-600",
    glow: "shadow-amber-500/25",
    wash: "from-amber-50/80 to-transparent dark:from-amber-950/30",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    link: "text-amber-600 dark:text-amber-500",
    hoverBorder: "hover:border-amber-300 dark:hover:border-amber-500/50",
  },
  persuasion: {
    tile: "from-brand-lavender to-fuchsia-500",
    glow: "shadow-fuchsia-500/25",
    wash: "from-fuchsia-50/80 to-transparent dark:from-fuchsia-950/30",
    chip: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300",
    link: "text-fuchsia-600 dark:text-fuchsia-400",
    hoverBorder: "hover:border-fuchsia-300 dark:hover:border-fuchsia-500/50",
  },
};
