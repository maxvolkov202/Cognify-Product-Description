"""
Cognify prosody worker v2 — prosody-v2 plan P2 (plans/prosody-v2-plan-2026-09.md).

Contract v2 is ADDITIVE and self-versioned. Response gains:
  featureVersion: 2
  finalFallRatio: float in [0,1] | None   # statement-final falling intonation share
  segmentTails:   [{endMs, tailSlopeHzPerSec}] | None
                  # per silence-bounded voiced segment; Node intersects these with
                  # Deepgram statement-end timestamps at SCORING time (the warm
                  # runs before any transcript exists) to compute aligned upspeak.

Extraction changes vs v1 (kept in main.py, still deployable):
  - pitch tracked once with floor 75 / ceiling 500 Hz + octave-outlier cleaning
    (frames >6 st from the median are dropped). The v1 default ceiling admitted
    ~590 Hz harmonic frames on PSOLA-flattened audio, inflating pitch std from
    0.07-0.10 to 1.2-1.7 st (verified against fixture ground truth 2026-09-02).
  - monotoneRatio is truly WINDOWED (1 s sliding windows, 250 ms step, ratio of
    windows with std < 1.5 st) — matching its documented meaning instead of
    being a pure function of the global std.
  - upspeakRatio/finalFallRatio are derived from the same segment tails the
    response now exposes, so the silence-heuristic fallback and the aligned
    Node-side numbers share one definition of "tail".

Deploy side-by-side (P1): modal deploy infra/prosody-worker/modal_app_v2.py
→ separate app `cognify-prosody-worker-v2`; switching is a PROSODY_WORKER_URL
env flip, revert adds PROSODY_FEATURE_VERSION_MAX=1 (Node cache guard).
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from typing import Any

import httpx
import numpy as np
import parselmouth
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

MAX_DURATION_MS = 180_000
DOWNLOAD_TIMEOUT_S = 10.0

PITCH_FLOOR_HZ = 75.0
PITCH_CEILING_HZ = 500.0
OCTAVE_OUTLIER_ST = 12.0         # legit expressive excursions reach ~6 st from median (range 10-12 st);
                                 # tracker artifacts sit ~2 octaves out (~+25 st) — 12 st separates them
MONOTONE_WINDOW_S = 1.0
MONOTONE_STEP_S = 0.25
MONOTONE_STD_ST = 1.5            # windowed std below this = monotone window
MONOTONE_MIN_VOICED = 40         # of ~100 frames/window; else window not evaluable
SEGMENT_MIN_FRAMES = 50          # >=500ms segment span = a "statement" candidate
GAP_BRIDGE_FRAMES = 30           # unvoiced gaps <300ms (stops, breaths) do NOT split a segment —
                                 # v1 split on every unvoiced frame, so statement ends rarely had
                                 # a matching tail and alignment starved (GW3, 2026-09-02)
TAIL_MAX_FRAMES = 30             # last ~300ms
TAIL_SLOPE_RISING_HZ_S = 50.0    # v1 used >0.5 Hz/frame at 10ms frames = 50 Hz/s
TAIL_SLOPE_FALLING_HZ_S = -50.0
SEGMENT_TAILS_CAP = 200          # ~60 expected at the 180s cap; hard payload bound — matches the
                                 # Node zod .max(200); ratios are computed over this SAME capped
                                 # list so shipped ratios stay reproducible from shipped tails

app = FastAPI(title="cognify-prosody-worker", version="2.0.0")


class Request(BaseModel):
    audioUrl: str = Field(..., min_length=8, max_length=4096)
    durationMs: int = Field(..., ge=0, le=MAX_DURATION_MS)


class SegmentTail(BaseModel):
    endMs: float
    tailSlopeHzPerSec: float


class Response(BaseModel):
    featureVersion: int = 2
    pitchMeanHz: float | None
    pitchStdSemitones: float | None
    pitchRangeSemitones: float | None
    monotoneRatio: float | None
    # True when monotoneRatio came from the sliding-window measurement; False
    # when the short-clip fallback derived it from the global std (the Node
    # tone core must NOT charge a std-derived value as an independent signal —
    # that is the v1 double-count).
    monotoneWindowed: bool | None
    upspeakRatio: float | None
    finalFallRatio: float | None
    rmsMean: float | None
    rmsStd: float | None
    articulationScore: float | None
    segmentTails: list[SegmentTail] | None


NULL_RESPONSE = dict(
    pitchMeanHz=None, pitchStdSemitones=None, pitchRangeSemitones=None,
    monotoneRatio=None, monotoneWindowed=None, upspeakRatio=None, finalFallRatio=None,
    rmsMean=None, rmsStd=None, articulationScore=None, segmentTails=None,
)

WORKER_TOKEN = os.environ.get("PROSODY_WORKER_TOKEN")


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"ok": True, "version": "2.0.0", "featureVersion": 2}


@app.post("/")
def analyze(req: Request, authorization: str | None = Header(default=None)) -> Response:
    if WORKER_TOKEN:
        if authorization != f"Bearer {WORKER_TOKEN}":
            raise HTTPException(status_code=401, detail="unauthorized")

    try:
        audio_path = _download(req.audioUrl)
    except Exception as exc:  # noqa: BLE001
        # A download failure is usually TRANSIENT (expired signed URL, storage
        # blip). Return 502 — Node treats non-2xx as "no result", so the warm
        # marks the row failed and the scorer retries in-request later. A 200
        # all-null here would be cached as status='ready' nulls forever.
        # Graceful nulls stay reserved for permanent audio problems (unreadable
        # codec in _load_sound below).
        print(f"[prosody-worker-v2] download failed: {exc}")
        raise HTTPException(status_code=502, detail="audio download failed")
    try:
        sound = _load_sound(audio_path)
    except Exception as exc:  # noqa: BLE001
        print(f"[prosody-worker-v2] failed to load audio: {exc}")
        return Response(**NULL_RESPONSE)
    finally:
        _safe_unlink(audio_path)

    track = _extract_pitch_track(sound)
    rms = _extract_rms(sound)
    articulation = _articulation_proxy(sound)

    if track is None:
        return Response(
            **{**NULL_RESPONSE, "rmsMean": rms.get("mean"), "rmsStd": rms.get("std"),
               "articulationScore": articulation},
        )

    tails = _segment_tails(track)
    up, fall = _tail_ratios(tails)
    mono = _windowed_monotone(track)
    return Response(
        pitchMeanHz=track["meanHz"],
        pitchStdSemitones=track["stdSemitones"],
        pitchRangeSemitones=track["rangeSemitones"],
        monotoneRatio=mono[0] if mono else None,
        monotoneWindowed=mono[1] if mono else None,
        upspeakRatio=up,
        finalFallRatio=fall,
        rmsMean=rms.get("mean"),
        rmsStd=rms.get("std"),
        articulationScore=articulation,
        segmentTails=[SegmentTail(**t) for t in tails] or None,
    )


# ——— Pitch pipeline (single tracking pass, reused everywhere) ————————


def _extract_pitch_track(sound: "parselmouth.Sound") -> dict[str, Any] | None:
    """Track pitch once (bounded range), clean octave-jump outliers, and return
    the cleaned frame arrays plus the summary stats. None when too little voicing."""
    try:
        pitch_obj = sound.to_pitch(
            time_step=0.01, pitch_floor=PITCH_FLOOR_HZ, pitch_ceiling=PITCH_CEILING_HZ
        )
        f0_all = pitch_obj.selected_array["frequency"]
        times = pitch_obj.xs()
        voiced = f0_all > 0
        if int(np.sum(voiced)) < 10:
            return None
        st_all = np.where(voiced, 12 * np.log2(np.maximum(f0_all, 1e-6) / 100.0), np.nan)
        median_st = float(np.nanmedian(st_all[voiced]))
        keep = voiced & (np.abs(st_all - median_st) <= OCTAVE_OUTLIER_ST)
        if int(np.sum(keep)) < 10:
            return None
        f0 = f0_all[keep]
        st = st_all[keep]
        return {
            "meanHz": float(np.mean(f0)),
            "stdSemitones": float(np.std(st)),
            "rangeSemitones": float(np.max(st) - np.min(st)),
            "times": times,          # full frame timeline (10ms grid)
            "f0_all": f0_all,        # raw track (for tail slopes)
            "keep": keep,            # cleaned-voiced mask on the full timeline
            "st_full": st_all,       # semitones on the full timeline (nan when unvoiced)
        }
    except Exception as exc:  # noqa: BLE001
        print(f"[prosody-worker-v2] pitch extraction failed: {exc}")
        return None


def _windowed_monotone(track: dict[str, Any]) -> tuple[float, bool] | None:
    """Ratio of 1s sliding windows whose pitch std is below MONOTONE_STD_ST.
    Windows with too few voiced frames are not evaluable; <3 evaluable → None."""
    times, keep, st = track["times"], track["keep"], track["st_full"]
    if len(times) == 0:
        return None
    step = MONOTONE_STEP_S
    win = MONOTONE_WINDOW_S
    t0, t_end = float(times[0]), float(times[-1])
    evaluable = 0
    monotone = 0
    start = t0
    while start + win <= t_end + 1e-9:
        mask = keep & (times >= start) & (times < start + win)
        if int(np.sum(mask)) >= MONOTONE_MIN_VOICED:
            evaluable += 1
            if float(np.std(st[mask])) < MONOTONE_STD_ST:
                monotone += 1
        start += step
    if evaluable < 3:
        # Too short for windows (<~1.5s of voicing): fall back to the v1-style ramp
        # from the global std so short reps keep monotone evidence instead of null.
        # windowed=False so the tone core knows this is std-derived (no double-count).
        std = track["stdSemitones"]
        if std <= 1.5:
            return 1.0, False
        if std >= 4.5:
            return 0.0, False
        return float(1.0 - (std - 1.5) / 3.0), False
    return monotone / evaluable, True


def _segment_tails(track: dict[str, Any]) -> list[dict[str, float]]:
    """Pause-bounded segments (voiced runs bridged across <300ms unvoiced gaps,
    total span >=500ms) with the F0 slope over the last ~300ms of voiced frames,
    in Hz/sec. Segment ends sit at real pauses, which is where statement ends sit —
    that is what makes Node-side alignment with Deepgram word ends possible. The
    worker itself stays transcript-free (warm-time constraint)."""
    keep = track["keep"]
    f0_all = track["f0_all"]
    times = track["times"]
    voiced_idx = np.flatnonzero(keep)
    if len(voiced_idx) == 0:
        return []
    segments: list[tuple[int, int]] = []
    seg_start = int(voiced_idx[0])
    prev = int(voiced_idx[0])
    for i in voiced_idx[1:]:
        if int(i) - prev > GAP_BRIDGE_FRAMES:
            segments.append((seg_start, prev))
            seg_start = int(i)
        prev = int(i)
    segments.append((seg_start, prev))
    tails: list[dict[str, float]] = []
    for start, end in segments:  # inclusive frame indices
        if end - start + 1 < SEGMENT_MIN_FRAMES:
            continue
        lo = max(start, end - TAIL_MAX_FRAMES + 1)
        idx = np.arange(lo, end + 1)
        # Fit ONLY cleaned-voiced frames (an octave-artifact frame in the tail would
        # swing the slope), against the REAL time axis (bridged gaps must not compress
        # the x spacing and inflate Hz/sec).
        sel = idx[keep[lo : end + 1]]
        if len(sel) < 5:
            continue
        slope_hz_per_sec = float(np.polyfit(times[sel], f0_all[sel], 1)[0])
        tails.append({
            "endMs": float(times[end] * 1000.0),
            "tailSlopeHzPerSec": slope_hz_per_sec,
        })
        if len(tails) >= SEGMENT_TAILS_CAP:
            break
    return tails


def _tail_ratios(tails: list[dict[str, float]]) -> tuple[float | None, float | None]:
    """Silence-heuristic upspeak/finalFall ratios from the segment tails — the
    fallback when the scorer has no word timings to align against."""
    if len(tails) < 2:
        return None, None
    rising = sum(1 for t in tails if t["tailSlopeHzPerSec"] > TAIL_SLOPE_RISING_HZ_S)
    falling = sum(1 for t in tails if t["tailSlopeHzPerSec"] < TAIL_SLOPE_FALLING_HZ_S)
    return rising / len(tails), falling / len(tails)


# ——— Unchanged v1 helpers (copied; v1 file stays deployable untouched) ————


def _extract_rms(sound: "parselmouth.Sound") -> dict[str, float | None]:
    try:
        intensity = sound.to_intensity(time_step=0.05)
        values = intensity.values.flatten()
        values = values[~np.isnan(values)]
        if len(values) < 5:
            return {"mean": None, "std": None}
        return {"mean": float(np.mean(values)), "std": float(np.std(values))}
    except Exception as exc:  # noqa: BLE001
        print(f"[prosody-worker-v2] intensity extraction failed: {exc}")
        return {"mean": None, "std": None}


def _articulation_proxy(sound: "parselmouth.Sound") -> float | None:
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
        if ratio <= 0.05:
            return 0.0
        if ratio >= 0.30:
            return 1.0
        return float((ratio - 0.05) / 0.25)
    except Exception as exc:  # noqa: BLE001
        print(f"[prosody-worker-v2] articulation extraction failed: {exc}")
        return None


def _load_sound(audio_path: str) -> "parselmouth.Sound":
    try:
        return parselmouth.Sound(audio_path)
    except Exception as direct_exc:  # noqa: BLE001
        print(f"[prosody-worker-v2] direct load failed ({direct_exc}); transcoding with ffmpeg")
        wav_path = _transcode_to_wav(audio_path)
        try:
            return parselmouth.Sound(wav_path)
        finally:
            _safe_unlink(wav_path)


def _transcode_to_wav(src_path: str) -> str:
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    subprocess.run(
        ["ffmpeg", "-nostdin", "-y", "-i", src_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
        check=True, capture_output=True, timeout=20,
    )
    return wav_path


def _download(url: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".webm")
    os.close(fd)
    try:
        with httpx.Client(timeout=DOWNLOAD_TIMEOUT_S) as client:
            with client.stream("GET", url) as response:
                response.raise_for_status()
                with open(path, "wb") as f:
                    for chunk in response.iter_bytes():
                        f.write(chunk)
    except Exception:
        _safe_unlink(path)
        raise
    return path


def _safe_unlink(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass
