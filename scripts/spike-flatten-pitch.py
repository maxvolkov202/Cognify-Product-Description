# Phase 3.1 — resynthesize genuinely FLAT fixtures via Praat PSOLA.
#
# gpt-4o-mini-tts cannot produce true monotone (measured pitchStd ~2.9
# semitones on "flat" instructions vs 3.2 expressive). Instead of trusting
# TTS styling, take each EXPRESSIVE clip, replace its pitch tier with a
# constant at the clip's median F0, and resynthesize (Praat Manipulation/
# PSOLA). Result: pitchStd ~0 with identical words, timing, and voice —
# a perfectly controlled tone pair where pitch variation is the ONLY
# manipulated variable.
#
# Usage: python scripts/spike-flatten-pitch.py
# Writes <script>__flat.wav next to the mp3 fixtures and updates
# manifest.json (flat entries point at the wav files).

import json
import statistics
from pathlib import Path

import parselmouth
from parselmouth.praat import call

FIXTURE_DIR = Path("tests/fixtures/audio-grading")

def flatten(src: Path, dst: Path):
    snd = parselmouth.Sound(str(src))
    manipulation = call(snd, "To Manipulation", 0.01, 75, 500)
    pitch_tier = call(manipulation, "Extract pitch tier")
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    voiced = [
        pitch.get_value_in_frame(i + 1)
        for i in range(pitch.get_number_of_frames())
    ]
    voiced = [v for v in voiced if v is not None and v == v and v > 0]
    median_f0 = statistics.median(voiced)
    call(pitch_tier, "Remove points between", 0, snd.get_total_duration())
    call(pitch_tier, "Add point", snd.get_total_duration() / 2, median_f0)
    call([pitch_tier, manipulation], "Replace pitch tier")
    flat = call(manipulation, "Get resynthesis (overlap-add)")
    flat.save(str(dst), "WAV")

def main():
    manifest_path = FIXTURE_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    for fx in manifest["fixtures"]:
        if fx["style"] != "flat":
            continue
        script_id = fx["scriptId"]
        src = FIXTURE_DIR / f"{script_id}__expressive.mp3"
        dst = FIXTURE_DIR / f"{script_id}__flat.wav"
        flatten(src, dst)
        old = FIXTURE_DIR / fx["file"]
        if old.suffix == ".mp3" and old.exists():
            old.unlink()  # drop the failed TTS-styled flat clip
        fx["file"] = dst.name
        fx["note"] = "PSOLA pitch-flattened from the expressive clip (constant median F0)"
        print(f"flattened -> {dst.name}")
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf8")
    print("manifest updated")

if __name__ == "__main__":
    main()
