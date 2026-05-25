# Dark mode palette reference

The reference aesthetic for Cognify dark mode is the original LibraryCallout
look — dark ink gradient with brand-lavender eyebrows and white/ink-light body
copy. The CoachMemo card on the dashboard used the same recipe.

Both were recolored to light during the light-mode normalization pass; this
file preserves the exact original tokens so the dark-mode recoloring pack can
restore the look 1:1 when `.dark` is on the root element.

## Surface (dark mode root)

- Page background: `from-ink-50/40 via-white to-ink-50/30` → in dark, swap to
  `from-ink-950 via-ink-900 to-ink-950`.
- Card surface: `bg-white` → `bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900`.
- Card border: `border-ink-200` → `border-ink-700`.

## Eyebrow / label

- Light: `text-brand-purple` or `text-ink-500`.
- Dark: `text-brand-lavender` (the lighter mid-band gradient stop).

## Body copy

- Headline: `text-ink-900` → `text-white`.
- Primary body: `text-ink-700` → `text-white/90` or `text-ink-100`.
- Secondary body: `text-ink-600` → `text-white/70` or `text-ink-300`.
- Caption / meta: `text-ink-500` → `text-white/60` or `text-ink-400`.

## Accent marks

The brand gradient (`brand-gradient` utility) stays the same in both modes —
that's the through-line that keeps Cognify visually coherent across themes.
Glow shadows shift: light uses `rgba(176,114,255,0.45)`, dark uses
`rgba(176,114,255,0.6)` (warmer, more saturated since the bg eats some light).

## Original LibraryCallout (the canonical dark spec)

```tsx
<Link
  href="/library"
  className="group relative flex items-center gap-4 overflow-hidden rounded-3xl
             border border-ink-200 bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900
             p-5 text-white transition-all hover:-translate-y-0.5
             hover:shadow-[0_18px_50px_-22px_rgba(20,20,40,0.6)] md:p-6"
>
  <div className="pointer-events-none absolute -right-10 -top-10 size-40
                  rounded-full bg-brand-blue/20 blur-3xl" aria-hidden="true" />
  <div className="pointer-events-none absolute -bottom-12 -left-8 size-44
                  rounded-full bg-brand-magenta/15 blur-3xl" aria-hidden="true" />
  <div className="relative flex flex-1 items-center gap-4">
    <div className="brand-gradient grid size-11 shrink-0 place-items-center
                    rounded-2xl shadow-[0_8px_24px_-8px_rgba(176,114,255,0.6)]">
      <BookOpen className="size-5 text-white" strokeWidth={2.5} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]
                    text-brand-lavender">Cognify Library</p>
      <p className="mt-0.5 text-sm font-bold text-white md:text-base">
        Watch what good looks like.
      </p>
      <p className="mt-0.5 line-clamp-1 text-xs text-white/70">
        Curated talks, stories, and guides. Build the taste, then run a rep.
      </p>
    </div>
    {/* chip + open chevron — see component for full markup */}
  </div>
</Link>
```

## Original CoachMemo (canonical dark spec, second example)

```tsx
<section className="relative overflow-hidden rounded-3xl border border-transparent
                    bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 p-6 text-white
                    shadow-[0_24px_60px_-24px_rgba(20,20,40,0.5)] md:p-8">
  <div className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full blur-3xl"
       aria-hidden="true"
       style={{ background: "radial-gradient(circle, rgba(106,163,255,0.35), transparent 70%)" }} />
  <div className="pointer-events-none absolute -bottom-20 -right-12 size-56 rounded-full blur-3xl"
       aria-hidden="true"
       style={{ background: "radial-gradient(circle, rgba(231,124,240,0.3), transparent 70%)" }} />

  <div className="relative">
    <div className="flex items-center gap-2.5">
      <div className="brand-gradient grid size-9 place-items-center rounded-xl">
        <Sparkles className="size-4 text-white" strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-lavender">
          Coach's memo
        </p>
        <p className="text-sm font-semibold text-white/80">What moved this week</p>
      </div>
    </div>

    {/* numbered insights with size-6 rounded-full bg-white/10 step markers */}
    {/* per-insight body: text-white/90 leading-relaxed */}
    {/* CTA pill: bg-white/10 backdrop-blur-sm text-white/90 */}
  </div>
</section>
```

Use both as the visual spec when reintroducing the dark theme via `.dark` overrides
on each surface.
