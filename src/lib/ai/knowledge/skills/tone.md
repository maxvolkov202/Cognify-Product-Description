# Skill: Tone

## Definition
Vocal expressiveness — pitch variation, downward inflection on statements, volume dynamics, vocal presence, crisp articulation. The first signal a listener processes; carries credibility and authority before words are decoded.

## HIGH tone — recognize these patterns
- Pitch range ≥3 semitones across the response (intentional variety)
- Statements close with downward pitch — conviction signal
- Volume contrasts mark important words ("you have *one* shot")
- Crisp articulation — consonants land, no mumbled trail-offs
- Vocal energy holds from first sentence to last
- Pauses are active (after key points), not hesitation pauses

## LOW tone — recognize these patterns
- Monotone — sustained flat pitch, low semitone variance over 20s+ windows
- Upspeak — rising inflection at the END of statements (reads as questions)
- Volume locked at one level — no emphasis variation
- Voice tightens / thins under pressure
- Mumbling — final consonants dropped, words trailing
- Vocal energy fades — last sentence has less presence than the first
- Breathy / quiet delivery suggesting the speaker doesn't believe themselves

## Prosody grounding (when prosody features supplied)
- pitch_variance_st < 1.5 → strong monotone signal
- upspeak_ratio > 0.4 → flag upspeak pattern
- rms_std_db < 2 → flag volume flatness
- final_quartile_rms_delta < -3dB → flag energy fade

When prosody is absent (`prosodyAvailable=false`), fall back to transcript heuristics and clearly state lower confidence.

## Edge-case rules (override per-dim rubric when in conflict)
- Variety-with-upspeak: strong pitch variance does NOT cancel an upspeak pattern; Tone stays LOW
- Crisp articulation + flat pitch: still monotone; articulation alone doesn't save Tone
- Pacing and Tone are different dims — fast pace with great pitch variety can still score high here

## Quote-driven callout shape
- positive: name the prosody moment (downward close, volume rise on key word) with the verbatim phrase
- warn/critical: name the monotone span or upspeak pattern with the phrase that exhibited it; suggest a vocal target ("close this with downward pitch")
