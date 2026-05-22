"use client";

// MascotCharacter — the visual layers for the Workout-shell mascot.
//
// Phase 4 ships a hand-authored placeholder character that's intentional
// and on-brand (not a stub). Phase 14 (deferred + optional) is where Max
// swaps the SVG layer contents below for a Figma-designed warmer
// character. The animation system + Mascot wrapper do NOT change in
// Phase 14 — only the contents inside each `<Layer layerName="...">` group.
//
// CONTRACT for Phase 14 author:
//   • Keep every <Layer layerName="..."> with the same name.
//   • Keep the same approximate bounding box (viewBox stays 0 0 120 160).
//   • Anchor the body's vertical centerline at x=60.
//   • Eyes and mouth live INSIDE Layer name="face" so blink/expression
//     swaps don't fight with head geometry.
//   • Legs (left-leg, right-leg) animate by walking; their pivot point
//     is the hip joint at (x=52, y=110) and (x=68, y=110) respectively.
//   • Dumbbells (left-dumbbell, right-dumbbell) are children of arms;
//     if arm geometry changes, move the dumbbell anchor accordingly.
//
// Animation mode: when the parent passes a `state` prop, each Layer
// uses its corresponding motion variants. Otherwise each Layer renders
// as a plain <g>. Phase 14 doesn't need to think about this — just edit
// the geometry inside the Layer bodies.

import { forwardRef, type ReactNode, type SVGProps } from "react";
import { motion, type Variants } from "motion/react";
import type { MuscleGroupId } from "@/types/domain";
import type { MascotState, ScoreBand } from "@/lib/animations/mascot-state";
import {
  containerVariants,
  faceVariants,
  headVariants,
  leftArmVariants,
  leftLegVariants,
  rightArmVariants,
  rightLegVariants,
  SCORE_BAND_INTENSITY,
} from "./variants";

const HEADBAND_COLORS: Record<MuscleGroupId, string> = {
  clarity: "#6aa3ff",
  structure: "#b39bff",
  conciseness: "#e77cf0",
  thinking_quality: "#b072ff",
  pacing: "#7fd6c8",
  tone: "#ffb38a",
};

/** Layer ids known to the animation system. Each <Layer> below should
 *  pass one of these. Phase 14 must keep the names stable. */
export const MASCOT_LAYER_NAMES = [
  "ground-shadow",
  "left-leg",
  "right-leg",
  "body",
  "left-arm",
  "left-dumbbell",
  "right-arm",
  "right-dumbbell",
  "head",
  "headband",
  "face",
  "container",
] as const;
export type MascotLayerName = (typeof MASCOT_LAYER_NAMES)[number];

const LAYER_VARIANTS: Partial<Record<MascotLayerName, Variants>> = {
  "left-leg": leftLegVariants,
  "right-leg": rightLegVariants,
  "left-arm": leftArmVariants,
  "right-arm": rightArmVariants,
  head: headVariants,
  face: faceVariants,
};

const LAYER_TRANSFORM_ORIGIN: Partial<Record<MascotLayerName, string>> = {
  "left-leg": "52px 110px",
  "right-leg": "68px 110px",
  "left-arm": "46px 92px",
  "right-arm": "74px 92px",
  head: "60px 50px",
  face: "60px 65px",
};

export type MascotCharacterProps = SVGProps<SVGSVGElement> & {
  /** Dim drives the headband color. NULL = neutral grey band. */
  dim?: MuscleGroupId | null;
  /** When provided, layers animate via motion variants. */
  state?: MascotState;
  /** Modulates celebrating-rep intensity (poor → sweat, excellent → big jump). */
  scoreBand?: ScoreBand;
};

const MascotCharacter = forwardRef<SVGSVGElement, MascotCharacterProps>(
  function MascotCharacter(
    { dim, state, scoreBand, ...svgProps },
    ref,
  ) {
    const bandColor = dim ? HEADBAND_COLORS[dim] : "#7c7c8a";
    const animated = state != null;

    // For excellent celebrations, override the static jump variant
    // with the score-band-scaled version (see SCORE_BAND_INTENSITY).
    const containerOverride =
      state === "celebrating-rep" && scoreBand
        ? celebrateContainerForBand(scoreBand)
        : containerVariants;

    return (
      <Layer
        layerName="container"
        animated={animated}
        state={state}
        variantsOverride={containerOverride}
        as="svg"
        viewBox="0 0 120 160"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
        forwardedRef={ref}
        {...svgProps}
      >
        <defs>
          {/* Brain body — soft salmon → coral, matches the cute-brain reference. */}
          <linearGradient id="mascot-brain-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffc1c1" />
            <stop offset="100%" stopColor="#f08585" />
          </linearGradient>
          {/* Brain highlight — subtle glossy top */}
          <radialGradient id="mascot-brain-highlight" cx="0.5" cy="0.25" r="0.5">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mascot-dumbbell-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b3349" />
            <stop offset="100%" stopColor="#1f1a29" />
          </linearGradient>
          <radialGradient id="mascot-cheek-grad" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#ff7a8a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff7a8a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <Layer layerName="ground-shadow" animated={animated} state={state}>
          <ellipse cx="60" cy="152" rx="26" ry="3.5" fill="#1f1a29" opacity="0.16" />
        </Layer>

        {/* Limbs — coral thin. Bigger brain means slightly lower limb
            attachment points. */}
        <Layer layerName="left-leg" animated={animated} state={state}>
          <line
            x1="52"
            y1="106"
            x2="46"
            y2="140"
            stroke="#d05a5a"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <ellipse cx="44" cy="144" rx="6.5" ry="3" fill="#b34a4a" />
        </Layer>
        <Layer layerName="right-leg" animated={animated} state={state}>
          <line
            x1="68"
            y1="106"
            x2="74"
            y2="140"
            stroke="#d05a5a"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <ellipse cx="76" cy="144" rx="6.5" ry="3" fill="#b34a4a" />
        </Layer>

        {/* Body slot — no visible torso; brain attaches direct to legs
            (matches the reference). Empty layer kept so animation
            machinery doesn't break. */}
        <Layer layerName="body" animated={animated} state={state} />

        <Layer layerName="left-arm" animated={animated} state={state}>
          <line
            x1="22"
            y1="74"
            x2="14"
            y2="92"
            stroke="#d05a5a"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <Layer layerName="left-dumbbell" animated={animated} state={state}>
            {/* Two-tone dumbbell weights */}
            <rect
              x="11"
              y="91"
              width="3"
              height="9"
              rx="1"
              fill="url(#mascot-dumbbell-grad)"
            />
            <circle cx="12.5" cy="89" r="4.5" fill="url(#mascot-dumbbell-grad)" />
            <circle cx="12.5" cy="102" r="4.5" fill="url(#mascot-dumbbell-grad)" />
          </Layer>
        </Layer>

        <Layer layerName="right-arm" animated={animated} state={state}>
          <line
            x1="98"
            y1="74"
            x2="106"
            y2="92"
            stroke="#d05a5a"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <Layer layerName="right-dumbbell" animated={animated} state={state}>
            <rect
              x="106"
              y="91"
              width="3"
              height="9"
              rx="1"
              fill="url(#mascot-dumbbell-grad)"
            />
            <circle cx="107.5" cy="89" r="4.5" fill="url(#mascot-dumbbell-grad)" />
            <circle cx="107.5" cy="102" r="4.5" fill="url(#mascot-dumbbell-grad)" />
          </Layer>
        </Layer>

        {/*
          HEAD — the brain.
          Lumpy cloud-style outline (4-5 visible lobes on each side)
          with many visible gyri swirls inside. Reference image 8.
          Bounding box: roughly (14..106, 10..98).
        */}
        <Layer layerName="head" animated={animated} state={state}>
          {/* Brain outline — bumpy "cumulus" cloud shape */}
          <path
            d="M 60 10
               C 70 8 78 12 84 18
               C 96 16 104 26 102 36
               C 110 44 108 58 102 66
               C 104 78 92 88 82 86
               C 78 92 70 96 64 94
               C 62 96 58 96 56 94
               C 50 96 42 92 38 86
               C 28 88 16 78 18 66
               C 12 58 10 44 18 36
               C 16 26 24 16 36 18
               C 42 12 50 8 60 10 Z"
            fill="url(#mascot-brain-grad)"
            stroke="#b54242"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* Subtle glossy top highlight */}
          <ellipse cx="60" cy="22" rx="32" ry="10" fill="url(#mascot-brain-highlight)" />

          {/* Central sulcus — the dividing line between hemispheres */}
          <path
            d="M 60 12 Q 58 30 60 50 Q 62 72 60 92"
            stroke="#b54242"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.6"
            fill="none"
          />

          {/* Left hemisphere — gyri swirls (comma/C-shapes) */}
          <path
            d="M 28 26 Q 36 22 44 28 Q 42 34 36 34"
            stroke="#b54242"
            strokeWidth="1.3"
            opacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 20 38 Q 30 36 40 42 Q 36 48 26 46"
            stroke="#b54242"
            strokeWidth="1.3"
            opacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 18 54 Q 28 52 40 58 Q 36 64 24 62"
            stroke="#b54242"
            strokeWidth="1.3"
            opacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 22 70 Q 32 68 42 74 Q 38 80 28 78"
            stroke="#b54242"
            strokeWidth="1.3"
            opacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
          {/* Small swirl detail */}
          <path
            d="M 32 80 q 4 -2 6 2"
            stroke="#b54242"
            strokeWidth="1"
            opacity="0.4"
            fill="none"
            strokeLinecap="round"
          />

          {/* Right hemisphere — mirrored swirls */}
          <path
            d="M 92 26 Q 84 22 76 28 Q 78 34 84 34"
            stroke="#b54242"
            strokeWidth="1.3"
            opacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 100 38 Q 90 36 80 42 Q 84 48 94 46"
            stroke="#b54242"
            strokeWidth="1.3"
            opacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 102 54 Q 92 52 80 58 Q 84 64 96 62"
            stroke="#b54242"
            strokeWidth="1.3"
            opacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 98 70 Q 88 68 78 74 Q 82 80 92 78"
            stroke="#b54242"
            strokeWidth="1.3"
            opacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 82 80 q 4 -2 6 2"
            stroke="#b54242"
            strokeWidth="1"
            opacity="0.4"
            fill="none"
            strokeLinecap="round"
          />

          {/* Cheek blush */}
          <circle cx="30" cy="72" r="5" fill="url(#mascot-cheek-grad)" />
          <circle cx="90" cy="72" r="5" fill="url(#mascot-cheek-grad)" />
        </Layer>

        {/* Headband — teal band across the forehead. Color set by dim. */}
        <Layer layerName="headband" animated={animated} state={state}>
          <path
            d="M 18 32
               C 18 24, 34 18, 60 18
               C 86 18, 102 24, 102 32
               L 102 42
               C 102 45, 86 47, 60 47
               C 34 47, 18 45, 18 42 Z"
            fill={bandColor}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth="0.6"
          />
          {/* Knot + tail on right side */}
          <ellipse cx="100" cy="36" rx="4" ry="3.5" fill={bandColor} />
          <path
            d="M 102 33 L 110 32 L 107 38 Z"
            fill={bandColor}
          />
        </Layer>

        {/*
          FACE — big expressive eyes, eyebrows, open friendly mouth with
          a hint of tongue. Sits below the headband (y >= 54).
        */}
        <Layer layerName="face" animated={animated} state={state}>
          {/* Eyebrows */}
          <path
            d="M 38 52 Q 44 49 50 52"
            stroke="#1f1a29"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 70 52 Q 76 49 82 52"
            stroke="#1f1a29"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          {/* Left eye — big & round */}
          <circle cx="44" cy="62" r="5.5" fill="#ffffff" />
          <circle cx="45" cy="63" r="3.4" fill="#1f1a29" />
          <circle cx="46.3" cy="61.6" r="1.2" fill="#ffffff" />
          {/* Right eye */}
          <circle cx="76" cy="62" r="5.5" fill="#ffffff" />
          <circle cx="77" cy="63" r="3.4" fill="#1f1a29" />
          <circle cx="78.3" cy="61.6" r="1.2" fill="#ffffff" />
          {/* Mouth — wide open friendly smile */}
          <path
            d="M 48 76 Q 60 90 72 76 Q 64 82 56 82 Q 50 82 48 76 Z"
            fill="#1f1a29"
            stroke="#1f1a29"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Tongue */}
          <path
            d="M 54 82 Q 60 86 66 82 Q 60 84 54 82 Z"
            fill="#ff8a9a"
          />
        </Layer>
      </Layer>
    );
  },
);

export default MascotCharacter;

// ─── Layer primitive ─────────────────────────────────────────────────────
//
// Renders a single named layer. In animated mode, wraps in motion.g (or
// motion.svg for the outer container) with the layer's variants applied
// and `animate={state}`. In static mode, falls back to plain g/svg.
//
// Carefully forwards only the props that are safe across React's SVG
// type and motion's SVGMotionProps — these diverge on event handlers
// like onAnimationStart (motion redefines it with AnimationDefinition).

type LayerProps = {
  layerName: MascotLayerName;
  animated: boolean;
  state?: MascotState;
  /** Override variants for this layer (used for celebrating-rep score band). */
  variantsOverride?: Variants;
  /** Force the underlying element type (used for the outer container). */
  as?: "g" | "svg";
  forwardedRef?: React.Ref<SVGSVGElement>;
  /** Outer container only: SVG-element-specific props. */
  viewBox?: string;
  xmlns?: string;
  role?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  children?: ReactNode;
};

function Layer({
  layerName,
  animated,
  state,
  variantsOverride,
  as,
  forwardedRef,
  viewBox,
  xmlns,
  role,
  width,
  height,
  className,
  style: styleProp,
  children,
  ...ariaRest
}: LayerProps) {
  const tag = as ?? "g";
  const layerVariants =
    layerName === "container"
      ? variantsOverride ?? containerVariants
      : LAYER_VARIANTS[layerName];
  const origin = LAYER_TRANSFORM_ORIGIN[layerName];
  const style: React.CSSProperties | undefined = origin
    ? { transformOrigin: origin, ...(styleProp ?? {}) }
    : styleProp;

  if (!animated || !state || !layerVariants) {
    if (tag === "svg") {
      return (
        <svg
          ref={forwardedRef}
          data-mascot-layer={layerName}
          viewBox={viewBox}
          xmlns={xmlns}
          role={role}
          width={width}
          height={height}
          className={className}
          style={style}
          {...ariaRest}
        >
          {children}
        </svg>
      );
    }
    return (
      <g
        data-mascot-layer={layerName}
        className={className}
        style={style}
      >
        {children}
      </g>
    );
  }

  if (tag === "svg") {
    return (
      <motion.svg
        ref={forwardedRef}
        data-mascot-layer={layerName}
        variants={layerVariants}
        animate={state}
        initial={false}
        viewBox={viewBox}
        xmlns={xmlns}
        role={role}
        width={width}
        height={height}
        className={className}
        style={style}
        {...ariaRest}
      >
        {children}
      </motion.svg>
    );
  }
  return (
    <motion.g
      data-mascot-layer={layerName}
      variants={layerVariants}
      animate={state}
      initial={false}
      className={className}
      style={style}
    >
      {children}
    </motion.g>
  );
}

function celebrateContainerForBand(band: ScoreBand): Variants {
  const intensity = SCORE_BAND_INTENSITY[band];
  // Re-derive the celebrating-rep keyframe using the band's jumpScale.
  const base = -12 * intensity.jumpScale;
  return {
    ...containerVariants,
    "celebrating-rep": {
      y: [0, base, 0, base * 0.5, 0],
      transition: {
        duration: 1.4,
        ease: "easeOut",
      },
    },
  };
}
