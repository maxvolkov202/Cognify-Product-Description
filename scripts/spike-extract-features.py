# Phase 3.1 — extract DSP prosody features for the spike's "enhanced
# prosody" arm (approach (b)). Emulates what the Praat worker would feed
# renderProsodyBlock: pitch variation, range, monotone ratio, volume
# variation, WPM.
#
# Usage: python scripts/spike-extract-features.py
# Writes tests/fixtures/audio-grading/features.json

import json
import math
import statistics
from pathlib import Path

import parselmouth

FIXTURE_DIR = Path("tests/fixtures/audio-grading")

def features(path: Path, transcript: str):
    snd = parselmouth.Sound(str(path))
    duration = snd.get_total_duration()
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    frames = []
    for i in range(pitch.get_number_of_frames()):
        v = pitch.get_value_in_frame(i + 1)
        t = pitch.get_time_from_frame_number(i + 1)
        if v is not None and v == v and v > 0:
            frames.append((t, 12 * math.log2(v / 100.0)))
    semis = [s for _, s in frames]
    pitch_std = statistics.pstdev(semis) if len(semis) > 10 else None
    if semis:
        s_sorted = sorted(semis)
        p5 = s_sorted[int(0.05 * (len(s_sorted) - 1))]
        p95 = s_sorted[int(0.95 * (len(s_sorted) - 1))]
        pitch_range = p95 - p5
    else:
        pitch_range = None
    # monotone ratio: fraction of 1s windows whose local pitch range < 1 semitone
    monotone_windows = 0
    total_windows = 0
    t0 = 0.0
    while t0 + 1.0 <= duration:
        window = [s for t, s in frames if t0 <= t < t0 + 1.0]
        if len(window) >= 5:
            total_windows += 1
            if max(window) - min(window) < 1.0:
                monotone_windows += 1
        t0 += 1.0
    monotone_ratio = (
        monotone_windows / total_windows if total_windows > 0 else None
    )
    intensity = snd.to_intensity()
    vals = [
        intensity.get_value(intensity.frame_number_to_time(i + 1))
        for i in range(intensity.get_number_of_frames())
    ]
    vals = [v for v in vals if v is not None and v == v and v > 0]
    rms_std = statistics.pstdev(vals) if len(vals) > 10 else None
    wpm = len(transcript.split()) / (duration / 60.0)
    return {
        "pitchStdSemitones": round(pitch_std, 2) if pitch_std is not None else None,
        "pitchRangeSemitones": round(pitch_range, 2) if pitch_range is not None else None,
        "monotoneRatio": round(monotone_ratio, 2) if monotone_ratio is not None else None,
        "intensityStdDb": round(rms_std, 2) if rms_std is not None else None,
        "wordsPerMinute": round(wpm),
        "durationSec": round(duration, 1),
    }

def main():
    manifest = json.loads((FIXTURE_DIR / "manifest.json").read_text(encoding="utf8"))
    out = {}
    for fx in manifest["fixtures"]:
        out[fx["file"]] = features(FIXTURE_DIR / fx["file"], fx["transcript"])
        print(fx["file"], out[fx["file"]])
    (FIXTURE_DIR / "features.json").write_text(json.dumps(out, indent=2), encoding="utf8")
    print("wrote features.json")

if __name__ == "__main__":
    main()
