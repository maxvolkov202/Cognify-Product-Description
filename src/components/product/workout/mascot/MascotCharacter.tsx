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

        {/* Limbs are coral, thin, with rounded feet/hands — cartoon-friendly. */}
        <Layer layerName="left-leg" animated={animated} state={state}>
          <line
            x1="52"
            y1="110"
            x2="48"
            y2="142"
            stroke="#d05a5a"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          {/* Shoe / foot */}
          <ellipse cx="46" cy="146" rx="6.5" ry="3" fill="#b34a4a" />
        </Layer>
        <Layer layerName="right-leg" animated={animated} state={state}>
          <line
            x1="68"
            y1="110"
            x2="72"
            y2="142"
            stroke="#d05a5a"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <ellipse cx="74" cy="146" rx="6.5" ry="3" fill="#b34a4a" />
        </Layer>

        {/* Brain stem stub — small, just to suggest the neck. */}
        <Layer layerName="body" animated={animated} state={state}>
          <rect x="56" y="92" width="8" height="14" rx="3" fill="#d05a5a" />
        </Layer>

        <Layer layerName="left-arm" animated={animated} state={state}>
          <line
            x1="34"
            y1="78"
            x2="20"
            y2="92"
            stroke="#d05a5a"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <Layer layerName="left-dumbbell" animated={animated} state={state}>
            <rect
              x="17"
              y="91"
              width="3"
              height="9"
              rx="1"
              fill="url(#mascot-dumbbell-grad)"
            />
            <circle cx="18.5" cy="89" r="4.5" fill="url(#mascot-dumbbell-grad)" />
            <circle cx="18.5" cy="102" r="4.5" fill="url(#mascot-dumbbell-grad)" />
          </Layer>
        </Layer>

        <Layer layerName="right-arm" animated={animated} state={state}>
          <line
            x1="86"
            y1="78"
            x2="100"
            y2="92"
            stroke="#d05a5a"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <Layer layerName="right-dumbbell" animated={animated} state={state}>
            <rect
              x="100"
              y="91"
              width="3"
              height="9"
              rx="1"
              fill="url(#mascot-dumbbell-grad)"
            />
            <circle cx="101.5" cy="89" r="4.5" fill="url(#mascot-dumbbell-grad)" />
            <circle cx="101.5" cy="102" r="4.5" fill="url(#mascot-dumbbell-grad)" />
          </Layer>
        </Layer>

        {/*
          HEAD — the brain. Two hemispheres with lumpy outlines + visible
          sulcus folds. Reference image style: rounded, cartoon-like, NOT
          geometric. The bottom dips slightly to suggest a brainstem
          connection. Animation pivots are unchanged.
        */}
        <Layer layerName="head" animated={animated} state={state}>
          {/* Left hemisphere outline — lumpy, organic curve */}
          <path
            d="M 60 18
               C 46 16, 30 22, 24 36
               C 18 50, 22 70, 32 82
               C 38 90, 48 94, 60 94
               L 60 18 Z"
            fill="url(#mascot-brain-grad)"
            stroke="#c75050"
            strokeWidth="0.8"
            strokeOpacity="0.5"
          />
          {/* Right hemisphere outline */}
          <path
            d="M 60 18
               C 74 16, 90 22, 96 36
               C 102 50, 98 70, 88 82
               C 82 90, 72 94, 60 94
               L 60 18 Z"
            fill="url(#mascot-brain-grad)"
            stroke="#c75050"
            strokeWidth="0.8"
            strokeOpacity="0.5"
          />
          {/* Glossy highlight on top */}
          <ellipse cx="60" cy="32" rx="32" ry="14" fill="url(#mascot-brain-highlight)" />
          {/* Central sulcus — the divide between hemispheres */}
          <path
            d="M 60 20 Q 58 40 60 60 Q 62 78 60 92"
            stroke="#c75050"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.55"
            fill="none"
          />
          {/* Left hemisphere sulcus folds — three curved lines */}
          <path
            d="M 30 38 Q 36 36 44 40"
            stroke="#c75050"
            strokeWidth="1.2"
            opacity="0.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 26 54 Q 36 50 46 54"
            stroke="#c75050"
            strokeWidth="1.2"
            opacity="0.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 30 72 Q 38 68 48 72"
            stroke="#c75050"
            strokeWidth="1.2"
            opacity="0.4"
            fill="none"
            strokeLinecap="round"
          />
          {/* Right hemisphere sulcus folds */}
          <path
            d="M 76 40 Q 84 36 90 38"
            stroke="#c75050"
            strokeWidth="1.2"
            opacity="0.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 74 54 Q 84 50 94 54"
            stroke="#c75050"
            strokeWidth="1.2"
            opacity="0.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 72 72 Q 82 68 90 72"
            stroke="#c75050"
            strokeWidth="1.2"
            opacity="0.4"
            fill="none"
            strokeLinecap="round"
          />
          {/* Cheek blush dots */}
          <circle cx="36" cy="68" r="5" fill="url(#mascot-cheek-grad)" />
          <circle cx="84" cy="68" r="5" fill="url(#mascot-cheek-grad)" />
        </Layer>

        {/* Headband — across the forehead, color set by dim. Tie tail on right side. */}
        <Layer layerName="headband" animated={animated} state={state}>
          <path
            d="M 24 38
               C 24 30, 38 26, 60 26
               C 82 26, 96 30, 96 38
               L 96 46
               C 96 49, 84 51, 60 51
               C 36 51, 24 49, 24 46 Z"
            fill={bandColor}
          />
          {/* Knot on right side */}
          <circle cx="94" cy="40" r="3.5" fill={bandColor} />
          <path
            d="M 96 38 L 104 36 L 102 42 Z"
            fill={bandColor}
          />
        </Layer>

        {/*
          FACE — eyes + mouth. Eyes are larger and rounder than the
          placeholder; mouth is a wider friendly smile. The face block
          sits BELOW the headband (y >= 58).
        */}
        <Layer layerName="face" animated={animated} state={state}>
          {/* Left eye */}
          <ellipse cx="46" cy="64" rx="4" ry="4.5" fill="#ffffff" />
          <circle cx="46" cy="65" r="2.8" fill="#1f1a29" />
          <circle cx="47" cy="63.5" r="1" fill="#ffffff" />
          {/* Right eye */}
          <ellipse cx="74" cy="64" rx="4" ry="4.5" fill="#ffffff" />
          <circle cx="74" cy="65" r="2.8" fill="#1f1a29" />
          <circle cx="75" cy="63.5" r="1" fill="#ffffff" />
          {/* Mouth — wide friendly smile */}
          <path
            d="M 50 78 Q 60 86 70 78"
            stroke="#1f1a29"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          {/* Tiny tongue tip showing — adds personality */}
          <path
            d="M 58 82 Q 60 84 62 82"
            stroke="#1f1a29"
            strokeWidth="0.8"
            fill="#ff8888"
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
