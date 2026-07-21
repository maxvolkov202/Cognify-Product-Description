"""
Cognify prosody worker — extracts pitch / volume / inflection / monotone
features from a rep's audio file. Called by the Next.js app via the
worker contract defined in src/lib/audio/prosody-worker.ts.

INPUT (POST JSON):
  { "audioUrl": "<signed Supabase URL>", "durationMs": <int> }

OUTPUT (200 JSON):
  {
    "pitchMeanHz":          float | null,
    "pitchStdSemitones":    float | null,   # std dev of F0 in semitones
    "pitchRangeSemitones":  float | null,   # peak-to-trough in semitones
    "monotoneRatio":        float in [0,1] | null,
    "upspeakRatio":         float in [0,1] | null,
    "rmsMean":              float | null,   # mean RMS energy
    "rmsStd":               float | null,   # std dev of RMS energy
    "articulationScore":    float in [0,1] | null
  }

ALL fields nullable so the worker can return partial results when one
analysis step fails (e.g. parselmouth pitch tracking can return empty
when the input is silence). The Node side only treats null as "no data."

Why parselmouth (Praat) over librosa for pitch:
  Praat's PYIN-style pitch tracker is the reference implementation in
  speech research. librosa's piptrack is faster but materially less
  accurate on conversational speech. We accept the ~200ms parselmouth
  init cost; it's amortized across the request lifecycle.

DEPLOY: see infra/prosody-worker/README.md.
"""

from __future__ import annotations

import math
import os
import subprocess
import tempfile
from typing import Any

import httpx
import numpy as np
import parselmouth
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Caps so a malformed request can't pin a worker for minutes.
MAX_DURATION_MS = 180_000
DOWNLOAD_TIMEOUT_S = 10.0

app = FastAPI(title="cognify-prosody-worker", version="1.0.0")


class Request(BaseModel):
    audioUrl: str = Field(..., min_length=8, max_length=4096)
    durationMs: int = Field(..., ge=0, le=MAX_DURATION_MS)


class Response(BaseModel):
    pitchMeanHz: float | None
    pitchStdSemitones: float | None
    pitchRangeSemitones: float | None
    monotoneRatio: float | None
    upspeakRatio: float | None
    rmsMean: float | None
    rmsStd: float | None
    articulationScore: float | None


WORKER_TOKEN = os.environ.get("PROSODY_WORKER_TOKEN")


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"ok": True, "version": "1.0.0"}


@app.post("/")
def analyze(req: Request, authorization: str | None = Header(default=None)) -> Response:
    # Optional shared-secret auth so randoms can't burn worker time.
    if WORKER_TOKEN:
        expected = f"Bearer {WORKER_TOKEN}"
        if authorization != expected:
            raise HTTPException(status_code=401, detail="unauthorized")

    audio_path = _download(req.audioUrl)
    try:
        sound = _load_sound(audio_path)
    except Exception as exc:  # noqa: BLE001
        # Bad codec / unreadable file (even after ffmpeg transcode) → return
        # all nulls so the Node side falls back to inline-only without breaking.
        print(f"[prosody-worker] failed to load audio: {exc}")
        return Response(
            pitchMeanHz=None,
            pitchStdSemitones=None,
            pitchRangeSemitones=None,
            monotoneRatio=None,
            upspeakRatio=None,
            rmsMean=None,
            rmsStd=None,
            articulationScore=None,
        )
    finally:
        _safe_unlink(audio_path)

    pitch = _extract_pitch(sound)
    rms = _extract_rms(sound)
    monotone_ratio = _monotone_ratio(pitch)
    upspeak_ratio = _upspeak_ratio(sound, pitch)
    articulation = _articulation_proxy(sound)

    return Response(
        pitchMeanHz=pitch.get("meanHz"),
        pitchStdSemitones=pitch.get("stdSemitones"),
        pitchRangeSemitones=pitch.get("rangeSemitones"),
        monotoneRatio=monotone_ratio,
        upspeakRatio=upspeak_ratio,
        rmsMean=rms.get("mean"),
        rmsStd=rms.get("std"),
        articulationScore=articulation,
    )


# ——— Implementation helpers —————————————————————————————

def _load_sound(audio_path: str) -> "parselmouth.Sound":
    """Load audio into a parselmouth Sound.

    Praat's own readers cover WAV/AIFF/FLAC/MP3/Ogg-Vorbis but NOT the
    WebM/Matroska container that browsers record by default
    (audio/webm;codecs=opus). So: try Praat directly (fast path for the
    formats it groks), and on ANY failure transcode to a normalized
    16kHz mono WAV with ffmpeg (present in the Modal image) and retry.
    This is what makes real user recordings — not just the wav/mp3
    calibration fixtures — actually produce prosody.
    """
    try:
        return parselmouth.Sound(audio_path)
    except Exception as direct_exc:  # noqa: BLE001
        print(
            f"[prosody-worker] direct load failed ({direct_exc}); "
            "transcoding with ffmpeg"
        )
        wav_path = _transcode_to_wav(audio_path)
        try:
            return parselmouth.Sound(wav_path)
        finally:
            _safe_unlink(wav_path)


def _transcode_to_wav(src_path: str) -> str:
    """Transcode any container/codec ffmpeg understands (webm/opus, ogg,
    mp4/aac, …) to a 16kHz mono PCM WAV parselmouth can always read.
    Raises CalledProcessError/FileNotFoundError if ffmpeg is missing or
    the input is undecodable — the caller turns that into an all-null
    response (graceful text-tier fallback on the Node side)."""
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    subprocess.run(
        [
            "ffmpeg", "-nostdin", "-y",
            "-i", src_path,
            "-ar", "16000",  # 16kHz is plenty for F0/intensity/spectral work
            "-ac", "1",      # mono
            "-f", "wav",
            wav_path,
        ],
        check=True,
        capture_output=True,
        timeout=20,
    )
    return wav_path


def _download(url: str) -> str:
    """Download the signed URL to a temp file. Caller is responsible
    for cleanup."""
    suffix = ".webm"  # MediaRecorder default; ffmpeg transcode handles the rest
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    with httpx.Client(timeout=DOWNLOAD_TIMEOUT_S) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            with open(path, "wb") as f:
                for chunk in response.iter_bytes():
                    f.write(chunk)
    return path


def _safe_unlink(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass


def _extract_pitch(sound: "parselmouth.Sound") -> dict[str, float | None]:
    """Run pitch tracking. Returns mean Hz + std + range in semitones.
    All semitone math uses 100Hz as the reference (arbitrary; only
    relative variation matters)."""
    try:
        pitch_obj = sound.to_pitch(time_step=0.01)
        f0 = pitch_obj.selected_array["frequency"]
        f0 = f0[f0 > 0]  # voiced frames only
        if len(f0) < 10:
            return {"meanHz": None, "stdSemitones": None, "rangeSemitones": None}
        mean_hz = float(np.mean(f0))
        # Convert to semitones relative to 100Hz; scale invariance via log2.
        semitones = 12 * np.log2(f0 / 100.0)
        std_st = float(np.std(semitones))
        range_st = float(np.max(semitones) - np.min(semitones))
        return {
            "meanHz": mean_hz,
            "stdSemitones": std_st,
            "rangeSemitones": range_st,
        }
    except Exception as exc:  # noqa: BLE001
        print(f"[prosody-worker] pitch extraction failed: {exc}")
        return {"meanHz": None, "stdSemitones": None, "rangeSemitones": None}


def _extract_rms(sound: "parselmouth.Sound") -> dict[str, float | None]:
    """Mean + std of RMS energy across 50ms windows."""
    try:
        intensity = sound.to_intensity(time_step=0.05)
        values = intensity.values.flatten()
        values = values[~np.isnan(values)]
        if len(values) < 5:
            return {"mean": None, "std": None}
        return {
            "mean": float(np.mean(values)),
            "std": float(np.std(values)),
        }
    except Exception as exc:  # noqa: BLE001
        print(f"[prosody-worker] intensity extraction failed: {exc}")
        return {"mean": None, "std": None}


def _monotone_ratio(pitch: dict[str, float | None]) -> float | None:
    """Heuristic: if pitch std < 1.5 semitones, treat as monotone window.
    For now we only have the global std (not per-window). Reduce to a
    binary signal: 1.0 if globally monotone, 0.0 otherwise. Per-window
    sliding-monotone detection is a TODO when the Node side needs finer
    grained data."""
    std = pitch.get("stdSemitones")
    if std is None:
        return None
    # Smooth ramp: 1.5 semitones = clearly monotone (1.0), 4.5+ = varied (0.0).
    if std <= 1.5:
        return 1.0
    if std >= 4.5:
        return 0.0
    return float(1.0 - (std - 1.5) / 3.0)


def _upspeak_ratio(
    sound: "parselmouth.Sound",
    pitch: dict[str, float | None],
) -> float | None:
    """Detect rising vs falling pitch at sentence boundaries.

    Approach: find silence-bounded segments (>300ms silence as a sentence
    boundary proxy), measure the slope of F0 in the last 300ms of each
    segment. Rising slope = upspeak.

    NOTE: this is a coarse heuristic. A production-grade upspeak detector
    needs forced-alignment to actual sentence boundaries from the
    transcript, not silence-based segmentation. This proxy is good enough
    for ratio-of-ratios scoring; refine when calibration data lands.
    """
    if pitch.get("stdSemitones") is None:
        return None
    try:
        pitch_obj = sound.to_pitch(time_step=0.01)
        f0 = pitch_obj.selected_array["frequency"]
        timestamps = pitch_obj.xs()

        # Find voiced segments. A "sentence" ends where there's >300ms of
        # silence followed by more voicing.
        voiced = f0 > 0
        segments: list[tuple[int, int]] = []
        i = 0
        while i < len(voiced):
            if voiced[i]:
                start = i
                while i < len(voiced) and voiced[i]:
                    i += 1
                end = i
                segments.append((start, end))
            else:
                i += 1
        # Filter to segments >= 50 frames (~500ms).
        long_segments = [s for s in segments if s[1] - s[0] >= 50]
        if len(long_segments) < 2:
            return None

        rising = 0
        for start, end in long_segments:
            tail_n = min(30, (end - start) // 3)  # last ~300ms
            tail = f0[end - tail_n : end]
            if len(tail) < 5:
                continue
            # Linear regression slope on the tail.
            xs = np.arange(len(tail))
            slope = float(np.polyfit(xs, tail, 1)[0])
            if slope > 0.5:  # Hz per frame; ~5Hz/100ms minimum
                rising += 1
        return rising / len(long_segments)
    except Exception as exc:  # noqa: BLE001
        print(f"[prosody-worker] upspeak extraction failed: {exc}")
        return None


def _articulation_proxy(sound: "parselmouth.Sound") -> float | None:
    """Crude articulation proxy: ratio of high-frequency energy (>2kHz) to
    total energy. Crisp consonants produce more high-frequency energy;
    mumbled speech is energy-poor in the upper bands.

    NOT a forensic articulation score — that requires forced alignment +
    phoneme classification. Good enough as a directional signal."""
    try:
        spectrogram = sound.to_spectrogram(window_length=0.025)
        sxx = spectrogram.values
        freqs = np.linspace(0, sound.sampling_frequency / 2, sxx.shape[0])
        total_energy = float(np.sum(sxx))
        if total_energy <= 0:
            return None
        high_band = sxx[freqs >= 2000]
        high_energy = float(np.sum(high_band))
        ratio = high_energy / total_energy
        # Map raw ratio to 0-1 articulation score; empirical band 0.05-0.30.
        if ratio <= 0.05:
            return 0.0
        if ratio >= 0.30:
            return 1.0
        return float((ratio - 0.05) / 0.25)
    except Exception as exc:  # noqa: BLE001
        print(f"[prosody-worker] articulation extraction failed: {exc}")
        return None
