# Mascot polish — Figma → SVG handoff (Phase G)

This is the paint-by-numbers handoff for swapping the Phase-4
placeholder character for a designed character without touching the
animation system, the state machine, the `/dev/mascot` debug surface,
or the `Mascot` wrapper.

**Scope:** edit the SVG geometry inside 12 named `<Layer>` groups in
`src/components/product/workout/mascot/MascotCharacter.tsx`. Nothing
else.

## Constraints (do not break)

1. **viewBox stays `0 0 120 160`.** The wrapper translates by 30px per
   station; changing the viewBox breaks station alignment.
2. **Body centerline at `x = 60`.** Animations assume bilateral symmetry
   around this line.
3. **Hip pivots:** `left-leg` rotates around `(52, 110)`, `right-leg`
   rotates around `(68, 110)`. If your design uses different hip
   positions, update `LAYER_TRANSFORM_ORIGIN` in `MascotCharacter.tsx`
   to match (it's a single map at top of file).
4. **Head bounding box:** roughly `(20–100, 14–88)`. Keep the head
   inside this box so the headband geometry still fits.
5. **Layer names stay identical.** The runtime keys variants and
   transform origins off them.

## The 12 layers

| layerName | What lives here | Animates how |
| --- | --- | --- |
| `container` | Outermost group; entrance/exit fades | container opacity |
| `ground-shadow` | The ellipse beneath the feet | scale + opacity by state |
| `left-leg` | Lower-left limb + foot | rotate around hip (walking) |
| `right-leg` | Lower-right limb + foot | rotate around hip (walking) |
| `body` | Torso shape between head + legs | static (passthrough variants) |
| `left-arm` | Upper-left limb (parent of left-dumbbell) | rotate/swing |
| `left-dumbbell` | Weight in left hand | follows arm; flex variant scales |
| `right-arm` | Upper-right limb (parent of right-dumbbell) | rotate/swing |
| `right-dumbbell` | Weight in right hand | follows arm; flex variant scales |
| `head` | Brain skull + sulcus + cheek tints | tilt / nod by state |
| `headband` | Color band across forehead | color = `HEADBAND_COLORS[dim]` |
| `face` | Eyes + mouth (and any blink art) | expression swap by state |

Per-dimension headband color is read from the `HEADBAND_COLORS` map at
top of `MascotCharacter.tsx`. Update those hexes if the designed
character needs different highlight tones; the contract is one color
per `MuscleGroupId` (the 6 muscle-group ids).

## Figma export flow

1. Open the designed character at 120×160 frame (or 1× any 4:3
   multiple).
2. Group the artwork by the 12 layer names above. Use the **exact**
   `layerName` strings as the Figma layer names — that makes
   side-by-side comparison fast.
3. Export each group as **SVG, preserve groups, do not flatten,
   include CSS variables: no**. Use absolute coordinates (Figma's
   default).
4. Open each exported SVG. The contents you want are everything
   inside the outermost `<g>` — that's what gets pasted into the
   `<Layer>` body in the React file. **Strip out the wrapping `<g>`;
   keep just the children.**
5. Paste into `MascotCharacter.tsx` between the existing `<Layer ...>`
   and `</Layer>` tags for the matching layer name.

## In-place template

The current file already has each layer commented in source. Just
replace the body. Example for `head`:

```tsx
// BEFORE:
<Layer layerName="head" animated={animated} state={state}>
  <path d="M 60 14 C 40 14..." fill="url(#mascot-brain-grad)" />
  <path d="M 60 14 C 80 14..." fill="url(#mascot-brain-grad)" />
  {/* …more placeholder paths… */}
</Layer>

// AFTER:
<Layer layerName="head" animated={animated} state={state}>
  {/* Paste Figma-exported children for "head" here */}
  <path d="M..." fill="..." />
  <path d="M..." fill="..." />
</Layer>
```

## Gradients + defs

The file declares 3 gradients in `<defs>` (`mascot-brain-grad`,
`mascot-dumbbell-grad`, `mascot-cheek-grad`). If the designed
character uses different gradients:

- Add new gradient defs alongside the existing ones (don't rename the
  existing ones — Phase 14 doesn't break Phase 4's fallback by
  default).
- Reference via `fill="url(#your-new-grad)"`.
- Keep gradient ids prefixed with `mascot-` to avoid collisions.

## Validating the swap

1. `npm run dev` → visit `/dev/mascot` (operator route).
2. Cycle through every `MascotState`: idle, walking, at-station-X,
   celebrating, stumbling, sweating, flexing. Confirm the designed
   character animates coherently in each.
3. Toggle reduced-motion in the OS — the still-frame fallback should
   look intentional (it freezes the idle state).
4. Resize the viewport from 320px to 1280px. Mascot should scale
   without clipping.
5. `npm run lint` + `npm test` — neither should regress (you're
   only editing inert SVG geometry, but worth confirming).

## What you do NOT need to touch

- `src/lib/animations/mascot-state.ts` (state machine)
- `src/components/product/workout/mascot/variants.ts` (motion variants)
- `src/components/product/workout/mascot/MascotFallback.tsx`
- `src/components/product/workout/Mascot.tsx` (wrapper)
- `src/app/(app)/dev/mascot/page.tsx`

## When to stop

The Phase 4 placeholder is production-acceptable. Phase G is a polish
pass, not a launch gate. Ship the muscle-group pivot with the
placeholder if the designed character isn't ready when the calibration
replay clears — design swap can land as a follow-up PR with no
behavioral risk.
