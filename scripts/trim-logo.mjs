import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(
  root,
  "..",
  "..",
  "Downloads",
  "Screenshot_4-5-2026_164058_www.cognifygym.com.jpeg",
);
const out = path.join(root, "public/logo/mark.png");

// 1. Trim the white-ish background aggressively. Threshold 90 eats into
//    soft drop-shadow + anti-alias halo from the screenshot.
const trimmed = await sharp(src)
  .trim({ background: "#ffffff", threshold: 90 })
  .toBuffer();
const trimmedMeta = await sharp(trimmed).metadata();
console.log("trimmed:", trimmedMeta.width, "x", trimmedMeta.height);

// 2. Square-pad to a uniform canvas so the squircle mask aligns.
const SIZE = 1024;
const squared = await sharp(trimmed)
  .resize({
    width: SIZE,
    height: SIZE,
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

// 3. Build an iOS-style squircle mask (rounded corners ~22.5% of side).
//    Apple's app icons use a continuous squircle; SVG rounded-rect rx is
//    a close-enough approximation at small sizes.
const radius = Math.round(SIZE * 0.225);
const maskSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
     <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${radius}" ry="${radius}" fill="white"/>
   </svg>`,
);

// 4. Composite logo with mask using dest-in: result keeps logo pixels
//    only where mask is opaque, so the squircle is the new alpha shape.
await sharp(squared)
  .composite([{ input: maskSvg, blend: "dest-in" }])
  .png({ compressionLevel: 9 })
  .toFile(out);

console.log("wrote", out, `at ${SIZE}x${SIZE} with squircle alpha mask`);
