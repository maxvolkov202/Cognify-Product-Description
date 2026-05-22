/// <reference lib="webworker" />
// Phase D — Serwist service worker for the muscle-group pivot PWA.
//
// Strategy:
//   - Static assets (/icons/*, /logo/*, /_next/static/*) — CacheFirst
//     with revision-keyed cache. Icons + logos almost never change.
//   - HTML navigations — NetworkFirst with 3s timeout, falls back to
//     cached shell so the install-to-home-screen experience survives
//     a brief connectivity blip.
//   - API routes — DEFAULT BYPASS. We never want to cache auth, score,
//     or rep-write requests. Default Serwist routing skips them.
//   - Audio uploads / mic blobs — DEFAULT BYPASS, same rationale.
//
// Activation: production only, registered by ServiceWorkerRegister.tsx
// (see src/components/product/ServiceWorkerRegister.tsx). Dev kept
// SW-free so HMR doesn't fight the cache.

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
