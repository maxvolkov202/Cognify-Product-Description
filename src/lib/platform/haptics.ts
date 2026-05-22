"use client";

// Phase 12 — haptic feedback shim.
//
// Today: navigator.vibrate on Android/Chrome (no-op on iOS Safari and
// desktop). When Capacitor lands, call @capacitor/haptics on native
// for proper iOS Taptic Engine feedback. Web fallback stays present.

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning";

const WEB_VIBRATE_MS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 30, 10],
  warning: [20, 60, 20],
};

export function haptic(style: HapticStyle = "light"): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(WEB_VIBRATE_MS[style]);
  } catch {
    // Some browsers throw on hostile permission policies.
  }
  // TODO: native path
  //   if (isNative()) Haptics.impact({ style: ImpactStyle.<...> })
}
