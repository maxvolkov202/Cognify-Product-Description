# Phase 3.1 — objective validation of the spike audio fixtures.
#
# The TTS styling claim ("flat" really is monotone, "rushed" really is
# fast) must be verified with DSP before the spike trusts the fixtures:
#   flat       : pitch std < 1.5 semitones (PSOLA-flattened: ~0.1)
#   expressive : pitch std >= 2.5 semitones (gpt-4o-mini-tts lands 2.9-3.4;
#                the tone signal is the PAIR SEPARATION vs the flattened
#                clip — >2.5 semitones apart — not the absolute value)
#   rushed     : WPM >= 190 (vs the transcript word count)
#   flat/expressive WPM in 120-185 (two scripts land at 183-184; both
#                sides of a tone pair share IDENTICAL timing after PSOLA,
#                so pace cannot confound the tone comparison)
#
# Usage: python scripts/spike-validate-fixtures.py
# Reads tests/fixtures/audio-grading/manifest.json; prints a JSON report
# and exits non-zero when any fixture fails its style gate.

import json
import math
import sys
from pathlib import Path

import parselmouth

FIXTURE_DIR = Path("tests/fixtures/audio-grading")

def pitch_stats(path: Path):
    snd = parselmouth.Sound(str(path))
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    values = [
        pitch.get_value_in_frame(i + 1)
        for i in range(pitch.get_number_of_frames())
    ]
    voiced = [v for v in values if v is not None and not math.isnan(v) and v > 0]
    if len(voiced) < 10:
        return None, snd.get_total_duration()
    semitones = [12 * math.log2(v / 100.0) for v in voiced]
    mean = sum(semitones) / len(semitones)
    var = sum((s - mean) ** 2 for s in semitones) / len(semitones)
    return math.sqrt(var), snd.get_total_duration()

def main():
    manifest = json.loads((FIXTURE_DIR / "manifest.json").read_text(encoding="utf8"))
    report = []
    failures = 0
    for fx in manifest["fixtures"]:
        path = FIXTURE_DIR / fx["file"]
        pitch_std, duration = pitch_stats(path)
        words = len(fx["transcript"].split())
        wpm = words / (duration / 60.0) if duration > 0 else 0
        style = fx["style"]
        ok = True
        reasons = []
        if pitch_std is None:
            ok = False
            reasons.append("no voiced frames")
        else:
            if style == "flat" and pitch_std >= 1.5:
                ok = False
                reasons.append(f"pitchStd {pitch_std:.2f} >= 1.5")
            if style == "expressive" and pitch_std < 2.5:
                ok = False
                reasons.append(f"pitchStd {pitch_std:.2f} < 2.5")
        if style == "rushed" and wpm < 190:
            ok = False
            reasons.append(f"wpm {wpm:.0f} < 190")
        if style in ("flat", "expressive") and not (120 <= wpm <= 185):
            ok = False
            reasons.append(f"wpm {wpm:.0f} outside 120-185")
        if not ok:
            failures += 1
        report.append(
            {
                "file": fx["file"],
                "style": style,
                "pitchStdSemitones": round(pitch_std, 2) if pitch_std else None,
                "wpm": round(wpm),
                "durationSec": round(duration, 1),
                "ok": ok,
                "reasons": reasons,
            }
        )
    print(json.dumps(report, indent=2))
    print(f"\n{len(report) - failures}/{len(report)} fixtures pass", file=sys.stderr)
    sys.exit(1 if failures else 0)

if __name__ == "__main__":
    main()
