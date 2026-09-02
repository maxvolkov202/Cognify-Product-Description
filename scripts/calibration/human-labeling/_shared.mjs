/**
 * Shared helpers for the human-labeling packet (grading plan WS2).
 * DB access is SELECT-only. Never import reauthor-expectations here.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const ROOT = resolve(new URL("../../..", import.meta.url).pathname);
/** Override with HUMAN_LABELING_DIR for dry runs against synthetic sheets. */
export const OUT_DIR = process.env.HUMAN_LABELING_DIR ?? resolve(ROOT, "plans/calibration/human-labeling-2026-09");
export const DIMS = ["clarity", "structure", "conciseness", "thinking_quality", "delivery", "tone"];
/** Sheet column names ↔ code dims (PRD terms on the sheet). */
export const DIM_COLUMNS = {
  clarity: "clarity_band",
  structure: "structure_band",
  conciseness: "conciseness_band",
  thinking_quality: "thinking_band",
  delivery: "pacing_band",
  tone: "tone_band",
};
export const BINARIES = ["headline_accurate", "coach_focus_right_lever", "hallucinated_claim"];

/** Rubric anchor bands (rubric-anchors.ts): 1 = 0-20 … 5 = 81-100. */
export function bandOf(score) {
  if (score == null || Number.isNaN(score)) return null;
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}
export const BAND_MIDPOINT = { 1: 10, 2: 30, 3: 50, 4: 70, 5: 90 };

/** Composite strata from the audit plan §5. */
export function compositeBand(c) {
  if (c < 50) return "<50";
  if (c < 65) return "50-65";
  if (c < 75) return "65-75";
  return "75+";
}

export function loadEnvLocal() {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** Deterministic PRNG so the sample is reproducible from the seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── tiny CSV ──
export function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows, columns) {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","))].join("\n") + "\n";
}
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

// ── stats ──
export function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN; }
export function mae(a, b) { return mean(a.map((x, i) => Math.abs(x - b[i]))); }
export function bias(model, human) { return mean(model.map((x, i) => x - human[i])); }
export function spearman(a, b) {
  const rank = (xs) => {
    const idx = xs.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(xs.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a), rb = rank(b), ma = mean(ra), mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : NaN;
}
/** Cohen's kappa, unweighted, over categorical labels. */
export function cohenKappa(a, b) {
  const n = a.length;
  if (!n) return NaN;
  const cats = [...new Set([...a, ...b])];
  let agree = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) agree++;
  const po = agree / n;
  let pe = 0;
  for (const c of cats) pe += (a.filter((x) => x === c).length / n) * (b.filter((x) => x === c).length / n);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}
/** Linear-weighted kappa for ordinal 1–5 bands (the headline agreement number). */
export function weightedKappa(a, b, k = 5) {
  const n = a.length;
  if (!n) return NaN;
  const obs = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) obs[a[i] - 1][b[i] - 1]++;
  const ra = new Array(k).fill(0), rb = new Array(k).fill(0);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { ra[i] += obs[i][j]; rb[j] += obs[i][j]; }
  let num = 0, den = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const w = Math.abs(i - j) / (k - 1);
    num += w * obs[i][j];
    den += (w * ra[i] * rb[j]) / n;
  }
  return den === 0 ? 1 : 1 - num / den;
}

// ── argv / signing / sheet-safety helpers (shared by the packet + mini-sheet builders) ──

/** Strict argv parser: --flag, --opt value, --opt=value. Unknown or malformed tokens abort
 *  instead of silently falling through to a destructive default path. */
export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([a-z][a-z0-9-]*)(?:=(.*))?$/);
    if (!m) throw new Error(`unrecognized argument: ${argv[i]}`);
    const [, key, inline] = m;
    if (flags.includes(key)) {
      if (inline != null && inline !== "true") throw new Error(`--${key} takes no value`);
      args[key] = true;
    } else if (options.includes(key)) {
      const v = inline ?? argv[++i];
      if (v == null || v.startsWith("--")) throw new Error(`--${key} needs a value`);
      args[key] = v;
    } else throw new Error(`unknown option --${key} (known: ${[...flags, ...options].map((k) => "--" + k).join(" ")})`);
  }
  return args;
}

/** TTL in seconds from a --ttl-days value; rejects NaN/zero/negative so links can't be signed dead. */
export function parseTtlDays(v) {
  const days = parseFloat(v ?? "7");
  if (!Number.isFinite(days) || days <= 0) throw new Error(`--ttl-days must be a positive number, got: ${v}`);
  return days * 24 * 3600;
}

/** Fisher-Yates with a caller-supplied PRNG (pass mulberry32(seed) for reproducibility). */
export function seededShuffle(xs, rng) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Sign storage paths, keyed by the REQUESTED path (order-based — never trust the echoed path).
 *  Dedupes first; strict mode aborts naming the unsigned paths so no dead links are written. */
export async function signStoragePaths(admin, bucket, paths, ttlS, { strict = false } = {}) {
  const unique = [...new Set(paths)];
  if (!unique.length) return new Map();
  const { data, error } = await admin.storage.from(bucket).createSignedUrls(unique, ttlS);
  if (error) {
    if (strict) throw new Error(`signing failed: ${error.message}`);
    console.warn("[sign] failed:", error.message);
  }
  const signed = new Map();
  for (const [i, d] of (data ?? []).entries()) if (d?.signedUrl) signed.set(unique[i], d.signedUrl);
  if (strict) {
    const missing = unique.filter((p) => !signed.has(p));
    if (missing.length) throw new Error(`unsigned paths (${missing.length}): ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? " …" : ""} — aborting so no dead links are written`);
  }
  return signed;
}

/** True when any row of the CSV has a non-empty cell in one of the given label columns —
 *  the guard that keeps re-sign/rebuild runs from clobbering rater work in gitignored files. */
export function sheetHasLabels(path, cols) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  return rows.some((r) => cols.some((c) => (r[c] ?? "") !== ""));
}

/** Rater-editable columns of the main labeling sheets. */
export const LABEL_COLUMNS = [...Object.values(DIM_COLUMNS), ...BINARIES, "notes"];
