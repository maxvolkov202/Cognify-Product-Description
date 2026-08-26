/**
 * Audio MIME normalization for the rep-audio upload path.
 *
 * Regression guard for the 2026-07-24 → 2026-08-26 outage: MediaRecorder
 * reports `audio/webm;codecs=opus`, Supabase Storage matches its bucket
 * allowlist against the FULL contentType string, so every upload 500'd
 * and `reps.audio_url` was NULL for every rep in that window.
 */
import {
  ALLOWED_AUDIO_MIME_TYPES,
  audioExtensionFor,
  isAllowedAudioMime,
  normalizeAudioMime,
} from "../src/lib/audio/mime";

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed++;
}

// ——— Parameter stripping — the actual bug ————————————————
assert(
  normalizeAudioMime("audio/webm;codecs=opus") === "audio/webm",
  "the codecs parameter Chrome/Edge send is stripped",
);
assert(
  normalizeAudioMime("audio/ogg;codecs=opus") === "audio/ogg",
  "the ogg codecs parameter is stripped",
);
assert(
  normalizeAudioMime("audio/mp4;codecs=mp4a.40.2") === "audio/mp4",
  "Safari's parameterized mp4 is stripped",
);
assert(
  normalizeAudioMime("audio/webm; codecs=opus") === "audio/webm",
  "a space before the parameter is tolerated",
);
assert(
  normalizeAudioMime("audio/webm;codecs=opus;foo=bar") === "audio/webm",
  "multiple parameters are all stripped",
);

// Already-bare types must pass through untouched.
for (const type of ALLOWED_AUDIO_MIME_TYPES) {
  assert(normalizeAudioMime(type) === type, `${type} passes through unchanged`);
}

// ——— Case + whitespace ————————————————————————————————
// RFC 9110: type/subtype is case-insensitive, so lowercasing is safe and
// makes the allowlist comparison exact rather than accidental.
assert(
  normalizeAudioMime(" AUDIO/MP4 ") === "audio/mp4",
  "case and surrounding whitespace are normalized",
);
assert(
  normalizeAudioMime("Audio/WebM;Codecs=Opus") === "audio/webm",
  "mixed case with a parameter normalizes",
);

// ——— Empty / absent ————————————————————————————————————
// `file.type` is "" when the browser can't determine it; the route
// substitutes its own default, so normalize must report empty, not guess.
assert(normalizeAudioMime("") === "", "empty string → empty");
assert(normalizeAudioMime(null) === "", "null → empty");
assert(normalizeAudioMime(undefined) === "", "undefined → empty");
assert(normalizeAudioMime(";codecs=opus") === "", "parameter-only → empty");

// ——— Allowlist ————————————————————————————————————————
for (const type of ALLOWED_AUDIO_MIME_TYPES) {
  assert(isAllowedAudioMime(type), `${type} is allowed`);
}
assert(
  isAllowedAudioMime(normalizeAudioMime("audio/webm;codecs=opus")),
  "the real MediaRecorder type is allowed AFTER normalization",
);
assert(
  !isAllowedAudioMime("audio/webm;codecs=opus"),
  "the raw parameterized type is NOT allowed — this is exactly what Storage rejected",
);
assert(!isAllowedAudioMime("audio/aac"), "a type the bucket rejects is not allowed");
assert(!isAllowedAudioMime("audio/flac"), "flac is not allowed");
assert(!isAllowedAudioMime("video/webm"), "a non-audio type is not allowed");
assert(!isAllowedAudioMime(""), "empty is not allowed");

// ——— Extension derivation ————————————————————————————————
assert(audioExtensionFor("audio/webm") === "webm", "webm → .webm");
assert(audioExtensionFor("audio/ogg") === "ogg", "ogg → .ogg");
assert(audioExtensionFor("audio/mp4") === "mp4", "mp4 → .mp4");
assert(audioExtensionFor("audio/mpeg") === "mp3", "mpeg → .mp3");
assert(audioExtensionFor("audio/wav") === "wav", "wav → .wav");
assert(audioExtensionFor("audio/aac") === "bin", "unknown → .bin");

// Every allowed type must map to a real extension — a new entry in the
// allowlist without a matching branch would silently file reps as .bin.
for (const type of ALLOWED_AUDIO_MIME_TYPES) {
  assert(
    audioExtensionFor(type) !== "bin",
    `${type} has a real extension, not the bin fallback`,
  );
}

// The old implementation used an ordered `includes()` chain, so a subtype
// embedding an earlier branch's name would be mis-filed. Exact matching
// makes that unrepresentable.
assert(
  audioExtensionFor("audio/webm-ish") === "bin",
  "a subtype merely CONTAINING an allowed name is not mis-filed",
);

// ——— End-to-end: every type the recorder can pick ————————————
// PREFERRED_MIME_TYPES in src/lib/audio/capture.ts. All four must
// normalize into the allowlist, or that browser's reps lose audio.
for (const recorded of [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
]) {
  const normalized = normalizeAudioMime(recorded);
  assert(
    isAllowedAudioMime(normalized),
    `recorder type ${recorded} survives normalization into the bucket allowlist`,
  );
  assert(
    audioExtensionFor(normalized) !== "bin",
    `recorder type ${recorded} gets a real file extension`,
  );
}

console.log(`${passed} passed, 0 failed`);
