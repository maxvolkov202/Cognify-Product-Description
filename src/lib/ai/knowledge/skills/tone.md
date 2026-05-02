# Skill: Tone

> "Vocal expressiveness — pitch variation, volume, downward inflection, presence, warmth, articulation."

Tone is the v3.0.0 dimension that captures *how the voice carries the meaning*. It's the first signal a listener's brain processes — before a single word is decoded — and it directly affects perceived credibility, authority, and trust. Same content, same structure, same thinking quality — delivered monotone or with rising statement-end pitch, it fails. A pitch-perfect explanation read with vocal flatness is a Tone failure even when everything else is on. This is the dimension most people have never deliberately trained, and one of the most measurable signals available to an audio-grading system.

## Definition

Pitch varies intentionally across the response — not random, not flat. Statements close with downward inflection, signaling conviction. Volume rises and falls to mark important words. Vocal energy holds from first sentence to last. Articulation is crisp; consonants are formed cleanly. The listener's takeaway: *this person sounds like they mean what they're saying — and I want to keep listening*.

## Experts and sources

- **Roger Love**, *Set Your Voice Free* — vocal coach to actors and CEOs; foundational on pitch range and breath support for spoken performance.
- **Quantified Communications** (research firm) — empirical work on filler words, pitch variance, and persuasive impact in business presentations. Showed executives using fewer fillers were rated 33% more persuasive.
- **Patsy Rodenburg**, *The Right to Speak* — the second-circle vocal presence framework used in actor training. Maps directly onto what audio listeners interpret as "command of the room."
- **Allan Pease**, *The Definitive Book of Body Language* — section on vocal cues; pitch variation correlates with perceived dominance and competence across cultures.
- **ScienceDirect (2021)** — "speaker confidence and accuracy are reflected in loudness, duration, and intonation; listeners decode these signals with up to 60% accuracy."
- **Journal of Experimental Psychology / Baker & McGowan (2013)** — audiences are 30% more likely to stay engaged during presentations with vocal variety vs monotone delivery.
- **Paralinguistics research on upspeak** — rising intonation at the end of statements (HRT, "high rising terminal") undercuts perceived authority across English-speaking populations. One of the most common and damaging vocal habits among young professionals.

## What great tone sounds like

- Pitch range of at least 3 semitones across a 60-second response
- Statements close with downward pitch — clear conviction signal
- Volume contrasts mark the most important words ("you have *one* shot at this")
- Articulation is crisp — consonants land, no mumbling at the ends of phrases
- Vocal energy holds — the last sentence is delivered with the same presence as the first
- Pauses are *active* — silence after a key point lets it land instead of sounding like hesitation
- Warmth comes through where the content calls for it; gravity comes through where the content calls for that

## What low tone sounds like

- Monotone — sustained flat pitch (low semitone variance over multiple sentences)
- Upspeak — statements that rise at the end and read as questions ("we're going to ship the feature?")
- Volume locked at one level for the entire rep — no emphasis variation
- Voice tightens or thins under pressure
- Mumbling — final consonants dropped, words trailing off
- Breathy or breathy-quiet delivery suggesting the speaker doesn't quite believe themselves
- Vocal energy fades across the response — last sentence sounds tired

## Signals (hybrid, prosody-grounded)

Tone is the **most prosody-dependent dimension** in the rubric. Cognify's scoring pipeline grounds Tone in raw audio features extracted server-side from the rep's audio file:

- **Pitch variance (std dev in semitones)** — proxy for vocal variety. Low values across multiple seconds = monotone.
- **Pitch range** — peak-to-trough across the rep. Higher = more expressiveness.
- **Inflection direction at sentence boundaries** — rising vs falling F0 in the last ~500ms before a sentence ends. High upspeak ratio penalizes Tone.
- **Volume dynamics (RMS std dev)** — variation in vocal loudness. Locked-flat volume penalizes Tone.
- **Monotone ratio** — % of speech with sustained low pitch variance.
- **Articulation proxy** — consonant clarity heuristic from Deepgram word-confidence + acoustic cleanliness.

When the prosody pipeline is offline (`prosodyAvailable: false`), Tone falls back to LLM-only scoring grounded in transcript heuristics — less accurate, clearly flagged on the rep so calibration trusts grounded scores more.

## Scoring boundaries

| Score | What it looks like |
|---|---|
| **95** | Wide intentional pitch range, every statement closes with conviction, articulation is crisp, vocal energy holds the listener through to the last word. |
| **80** | Clear vocal variety, mostly downward inflection, no significant flatness moments. |
| **60** | Adequate variation but flatness or one upspeak pattern shows up; articulation slips in places. |
| **40** | Mostly monotone, some upspeak, voice trails at the ends of phrases. |
| **20** | Sustained flat pitch, clear upspeak pattern, mumbled or breathy delivery throughout. |

## Exemplar callouts

- *(positive)* "The pitch dropped on every statement close — every assertion read as a fact, not a question. That's the conviction signal that lands."
- *(positive)* "Volume contrast at 0:22 — you doubled the volume on 'one shot' and it pulled the listener's attention exactly where you wanted it."
- *(warn)* "Eight statements in a row ended with rising pitch — the upspeak pattern reads as uncertainty even when your content was confident. Land the close with a downward beat next time."
- *(critical)* "Pitch variance was under 1.5 semitones across 45 seconds — that's monotone territory. Listeners disengage from flat delivery faster than they disengage from weak content."

## Common failure modes

- **Monotone lock** — sustained flat pitch, especially in the second half of a response
- **Upspeak** — statements that rise at the end, undercutting authority
- **Volume flatness** — no emphasis variation, every word weighted the same
- **Energy fade** — first sentence has presence; the last sentence trails off
- **Mumbled close** — final consonants dropped, the last word doesn't land
- **Breathiness under pressure** — the voice thins when stakes feel high

## Antipatterns to flag in scoring

- Statement intonation rising on declaratives
- Final phrase volume dropping below the average rep volume
- Pitch std dev below 1.5 semitones over any 20-second window
- Words ending in vowels with no consonant articulation ("the goal is..." instead of "the goal *is*")
- Run-on phrasing with no pitch resets between thoughts

## How to train tone

Cognify trains Tone through **two surfaces**: deliberate Tone drills in Skill Lab and prosody scoring on every rep across all modes. The Tone drill bank uses prompts that demand vocal control — "deliver this twice: first as if you're certain, then as if you're skeptical" / "speak this for 60 seconds with intentional pauses every 8 seconds" / "land the same statement three different ways: confident, doubtful, certain."

**Real-time hints** on the start-rep page surface 1-2 sub-skill cues drawn from the user's weakest Tone sub-skill — e.g. "land statements with downward pitch" / "pause two seconds after your conclusion" / "raise volume on the verbs that matter."

## Frameworks that train tone

- **PREP** — the impromptu framework benefits from intentional pace + pitch variation across each segment
- **STAR** — narrative arc rewards vocal variety (rising tension, falling resolution)
- **PPF** (Past-Present-Future) — natural pitch contour shifts between time frames

## See also

- `negotiation.md` — the domain where vocal presence does the most work
- `tough-feedback.md` — tone under emotional weight; warmth + gravity in the same rep
- `delivery.md` — adjacent dimension covering rate, pauses, and fillers; Delivery + Tone together = the full vocal picture
