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
          <linearGradient id="mascot-brain-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7a8e8" />
            <stop offset="100%" stopColor="#c771ff" />
          </linearGradient>
          <linearGradient id="mascot-dumbbell-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b3349" />
            <stop offset="100%" stopColor="#1f1a29" />
          </linearGradient>
          <radialGradient id="mascot-cheek-grad" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#ffb3e8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffb3e8" stopOpacity="0" />
          </radialGradient>
        </defs>

        <Layer layerName="ground-shadow" animated={animated} state={state}>
          <ellipse cx="60" cy="150" rx="28" ry="4" fill="#1f1a29" opacity="0.18" />
        </Layer>

        <Layer layerName="left-leg" animated={animated} state={state}>
          <line
            x1="52"
            y1="110"
            x2="48"
            y2="146"
            stroke="#3b3349"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <ellipse cx="46" cy="148" rx="7" ry="3.2" fill="#1f1a29" />
        </Layer>
        <Layer layerName="right-leg" animated={animated} state={state}>
          <line
            x1="68"
            y1="110"
            x2="72"
            y2="146"
            stroke="#3b3349"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <ellipse cx="74" cy="148" rx="7" ry="3.2" fill="#1f1a29" />
        </Layer>

        <Layer layerName="body" animated={animated} state={state}>
          <rect x="54" y="96" width="12" height="18" rx="5" fill="#3b3349" />
        </Layer>

        <Layer layerName="left-arm" animated={animated} state={state}>
          <line
            x1="46"
            y1="92"
            x2="26"
            y2="104"
            stroke="#3b3349"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <Layer layerName="left-dumbbell" animated={animated} state={state}>
            <rect
              x="20"
              y="102"
              width="3"
              height="10"
              rx="1"
              fill="url(#mascot-dumbbell-grad)"
            />
            <circle cx="21.5" cy="100" r="5" fill="url(#mascot-dumbbell-grad)" />
            <circle cx="21.5" cy="114" r="5" fill="url(#mascot-dumbbell-grad)" />
          </Layer>
        </Layer>

        <Layer layerName="right-arm" animated={animated} state={state}>
          <line
            x1="74"
            y1="92"
            x2="94"
            y2="104"
            stroke="#3b3349"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <Layer layerName="right-dumbbell" animated={animated} state={state}>
            <rect
              x="97"
              y="102"
              width="3"
              height="10"
              rx="1"
              fill="url(#mascot-dumbbell-grad)"
            />
            <circle cx="98.5" cy="100" r="5" fill="url(#mascot-dumbbell-grad)" />
            <circle cx="98.5" cy="114" r="5" fill="url(#mascot-dumbbell-grad)" />
          </Layer>
        </Layer>

        <Layer layerName="head" animated={animated} state={state}>
          <path
            d="M 60 14 C 40 14, 24 28, 24 50 C 24 70, 36 84, 50 88 C 54 92, 60 92, 60 88 Z"
            fill="url(#mascot-brain-grad)"
          />
          <path
            d="M 60 14 C 80 14, 96 28, 96 50 C 96 70, 84 84, 70 88 C 66 92, 60 92, 60 88 Z"
            fill="url(#mascot-brain-grad)"
          />
          <path
            d="M 60 16 L 60 88"
            stroke="#9a4fc9"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.45"
            fill="none"
          />
          <path
            d="M 38 34 q 8 -6 16 0"
            stroke="#9a4fc9"
            strokeWidth="1.2"
            opacity="0.35"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 66 34 q 8 -6 16 0"
            stroke="#9a4fc9"
            strokeWidth="1.2"
            opacity="0.35"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 34 62 q 10 6 18 0"
            stroke="#9a4fc9"
            strokeWidth="1.2"
            opacity="0.35"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 68 62 q 10 6 18 0"
            stroke="#9a4fc9"
            strokeWidth="1.2"
            opacity="0.35"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="40" cy="64" r="6" fill="url(#mascot-cheek-grad)" />
          <circle cx="80" cy="64" r="6" fill="url(#mascot-cheek-grad)" />
        </Layer>

        <Layer layerName="headband" animated={animated} state={state}>
          <path
            d="M 24 36 C 24 28, 36 22, 60 22 C 84 22, 96 28, 96 36 L 96 42 C 96 44, 92 46, 60 46 C 28 46, 24 44, 24 42 Z"
            fill={bandColor}
          />
          <circle cx="95" cy="36" r="3.2" fill={bandColor} />
          <line
            x1="96"
            y1="36"
            x2="102"
            y2="40"
            stroke={bandColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </Layer>

        <Layer layerName="face" animated={animated} state={state}>
          <circle cx="48" cy="60" r="3" fill="#1f1a29" />
          <circle cx="72" cy="60" r="3" fill="#1f1a29" />
          <circle cx="49" cy="59" r="0.9" fill="#ffffff" />
          <circle cx="73" cy="59" r="0.9" fill="#ffffff" />
          <path
            d="M 52 74 q 8 5 16 0"
            stroke="#1f1a29"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
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
