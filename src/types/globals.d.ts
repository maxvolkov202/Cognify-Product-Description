// Ambient browser globals not in the default DOM lib. Lets us drop the
// inline `as unknown as { ... }` casts that the audit (DC-7 area)
// flagged.

declare global {
  interface Window {
    /** Legacy Safari AudioContext. Polyfill detection in audio/capture.ts. */
    webkitAudioContext?: typeof AudioContext;
  }

  interface Navigator {
    /** Safari iOS "added to home screen" flag — true when the PWA is
     *  running in standalone mode. Used by InstallPrompt. */
    standalone?: boolean;
  }
}

export {};
