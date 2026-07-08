#!/usr/bin/env node
/**
 * Phase D — render real PWA app icons + iOS splash images from
 * public/logo/mark.png (1024×1024).
 *
 * Outputs:
 *   public/icons/icon-192.png         — Android home screen
 *   public/icons/icon-512.png         — Android home screen / install
 *   public/icons/icon-512-maskable.png — Android adaptive icon
 *                                        (24% padding inside safe zone)
 *   public/icons/apple-touch-icon.png — iOS home screen (180×180)
 *   public/icons/apple-splash-*.png   — iOS standalone splash variants
 *
 * Run: node scripts/generate-app-icons.mjs
 *
 * Idempotent. Uses sharp (transitive via next). Background color
 * #0f172a matches manifest.webmanifest.theme_color.
 */

import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BG = { r: 15, g: 23, b: 42, alpha: 1 }; // #0f172a — ink-950
const SRC = resolve("public/logo/mark.png");
const OUT_DIR = resolve("public/icons");

if (!existsSync(SRC)) {
  console.error(`Source mark missing: ${SRC}`);
  process.exit(2);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function plainIcon(size, name) {
  const out = resolve(OUT_DIR, name);
  await sharp(SRC)
    .resize(size, size, { fit: "contain", background: BG })
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ${name} ${size}×${size}`);
}

async function maskableIcon(size, name) {
  // Maskable spec: content must live within an 80%-diameter safe zone.
  // Render the mark at ~62% of the canvas (so it sits inside the safe
  // circle with breathing room) on the solid theme bg.
  const inner = Math.round(size * 0.62);
  const padded = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const out = resolve(OUT_DIR, name);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: padded, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ${name} ${size}×${size} (maskable)`);
}

async function appleSplash(width, height, name) {
  // Centered mark on theme bg. iOS expects the device-pixel resolution.
  const markSize = Math.round(Math.min(width, height) * 0.32);
  const padded = await sharp(SRC)
    .resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const out = resolve(OUT_DIR, name);
  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([{ input: padded, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ${name} ${width}×${height}`);
}

console.log(`Rendering app icons from ${SRC} → ${OUT_DIR}\n`);
await plainIcon(192, "icon-192.png");
await plainIcon(512, "icon-512.png");
await maskableIcon(512, "icon-512-maskable.png");
await plainIcon(180, "apple-touch-icon.png");

// iOS splash variants. Targets the three modern iPhone families and
// the iPad. Add more sizes if telemetry shows a meaningful share on
// older devices.
await appleSplash(1290, 2796, "apple-splash-iphone-15-pro-max.png");
await appleSplash(1179, 2556, "apple-splash-iphone-15-pro.png");
await appleSplash(1170, 2532, "apple-splash-iphone-14-13.png");
await appleSplash(1488, 2266, "apple-splash-ipad-mini.png");

console.log("\nDone. All icons written to public/icons/.");
