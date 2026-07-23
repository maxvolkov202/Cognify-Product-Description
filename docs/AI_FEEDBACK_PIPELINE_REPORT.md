# Cognify AI Feedback Pipeline — Analysis Report

**Scope:** Edge function `supabase/functions/score-rep/index.ts`. No code was changed.

---

## 1. Transcription Step

**Location:** After audio download and `File` construction, before scoring.

**Exact code snippet:**

```ts
const transcription = await openai.audio.transcriptions.create({
  model: "whisper-1",
  file,
})
```

**Details:**

| Item | Value |
|------|--------|
| **Model** | `whisper-1` |
| **Parameters** | `file` only (no `language`, `prompt`, `response_format`, or `temperature`; all use API defaults). |
| **Input** | `file` — a `File` built from the rep audio: `new File([audioBuffer], "recording.webm", { type: "audio/webm" })`. |

**How transcript is stored:**

- Raw text: `const transcript = transcription.text ?? ""`
- Word count: `const transcriptWordCount = transcript.trim().split(/\s+/).filter(Boolean).length`
- Both are written to the DB later in a single `reps` update:
  - `transcript` → `reps.transcript`
  - `transcript_word_count` → `reps.transcript_word_count`

---

## 2. Scoring Model Call

**Location:** First GPT call, immediately after the scoring system prompt is defined.

**Exact code snippet:**

```ts
const chatResponse = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: transcript },
  ],
  response_format: { type: "json_object" },
})
```

**Details:**

| Item | Value |
|------|--------|
| **Model** | `gpt-4o-mini` |
| **Temperature** | Not set (API default, typically 1.0 for chat). |
| **Max tokens** | Not set (API default). |

**Full system prompt (exact string):**

```
You evaluate executive communication quality. Return STRICT JSON only, no other text.
JSON structure:
{
  "overall_score": number,
  "delivery": {
    "pace": number,
    "clarity": number,
    "filler_words": number,
    "confidence": number,
    "pauses": number,
    "tone": number,
    "overall_delivery": number
  },
  "content": {
    "clarity": number,
    "structure": number,
    "brevity": number,
    "confidence": number
  }
}
Scores are 0-100. Return only valid JSON.
```

**User message:** The full `transcript` (Whisper output) only; no extra instructions.

**JSON schema expected:**

- `overall_score`: number (0–100)
- `delivery`: object with `pace`, `clarity`, `filler_words`, `confidence`, `pauses`, `tone`, `overall_delivery` (each number 0–100)
- `content`: object with `clarity`, `structure`, `brevity`, `confidence` (each number 0–100)

Enforcement is via `response_format: { type: "json_object" }`; there is no stricter schema (e.g. JSON Schema) in the API call.

---

## 3. Coaching Model Call

**Location:** Second GPT call, after scoring is parsed and coaching prompt is built.

**Exact code snippet:**

```ts
const coachingResponse = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: coachingSystemPrompt },
    { role: "user", content: "Generate the feedback JSON." },
  ],
  response_format: { type: "json_object" },
})
```

**Details:**

| Item | Value |
|------|--------|
| **Model** | `gpt-4o-mini` |
| **Temperature / max_tokens** | Not set. |

**Full system prompt (exact string, with variables interpolated):**

```
You are a high-performance communication coach.
Given the following context:
Vertical: ${vertical}
Scenario: ${scenario}
Audience: ${audience}
Framework: ${framework}
Overall Score: ${overallScore}
Delivery Score: ${deliveryScore}
Content Score: ${finalContentScore}

Transcript:
${transcript}

Respond ONLY in valid JSON with this exact structure:

{
  "feedback_good": "1-2 concise, specific sentences about what was effective.",
  "feedback_improve": "1-2 concise sentences about what needs improvement.",
  "next_focus": "One clear, actionable instruction for the next rep."
}

No extra commentary. No markdown.
Be specific to the scenario and audience.
Avoid generic praise.
```

**User message:** Literal string `"Generate the feedback JSON."` only.

**JSON schema returned:**

- `feedback_good`: string (1–2 sentences on what worked)
- `feedback_improve`: string (1–2 sentences on what to improve)
- `next_focus`: string (one actionable instruction for the next rep)

**Example output (illustrative):**

```json
{
  "feedback_good": "You stated the main point clearly and used a concrete example that matched the audience.",
  "feedback_improve": "Pacing was a bit fast in the middle; one clear pause before the recommendation would help.",
  "next_focus": "Add a 2-second pause after the problem statement before giving the recommendation."
}
```

Parsed in code and normalized to `null` if not a string:

```ts
const parsed = JSON.parse(coachingText) as {
  feedback_good?: string | null
  feedback_improve?: string | null
  next_focus?: string | null
}
feedbackGood = typeof parsed.feedback_good === "string" ? parsed.feedback_good : null
feedbackImprove = typeof parsed.feedback_improve === "string" ? parsed.feedback_improve : null
nextFocus = typeof parsed.next_focus === "string" ? parsed.next_focus : null
```

---

## 4. Prompt Inputs

All variables injected into the prompts and their sources:

| Variable | Source | Where used |
|----------|--------|------------|
| **transcript** | Whisper output: `transcription.text ?? ""` | Scoring user message; coaching system prompt (full transcript). |
| **vertical** | `rep.vertical ?? ""` (from `reps` row) | Coaching system prompt. |
| **scenario** | `rep.scenario ?? ""` (from `reps` row) | Coaching system prompt. |
| **audience** | `rep.audience ?? ""` (from `reps` row) | Coaching system prompt. |
| **framework** | `rep.framework ?? ""` (from `reps` row) | Coaching system prompt. |
| **overallScore** | From scoring GPT output: `num(scores.overall_score)` | Coaching system prompt. |
| **deliveryScore** | From scoring GPT: `Number(delivery.overall_delivery) \|\| 0` | Coaching system prompt. |
| **finalContentScore** | From scoring GPT: average of content clarity/structure/brevity/confidence, rounded | Coaching system prompt. |

**Origin of rep fields:** The `rep` row is loaded at the start with `supabase.from("reps").select("*").eq("id", repId).single()`. The columns `vertical`, `scenario`, `audience`, `framework` are set when the rep is created (e.g. in `RecordingArea.tsx` from the user’s scenario/config). There is no `time_limit` (or similar) in the coaching prompt; only the four context fields plus the three scores and the transcript are passed.

---

## 5. Database Mapping

**GPT/derived outputs → database columns**

**5.1 Scoring output → `reps` and `delivery_scores`**

- **From Whisper:**  
  - `transcript` → `reps.transcript`  
  - `transcriptWordCount` → `reps.transcript_word_count`

- **From scoring JSON:**  
  - `scores.overall_score` → `reps.overall_score` (via `num(scores.overall_score)`)  
  - `delivery.overall_delivery` → `reps.delivery_score`  
  - Content average (clarity/structure/brevity/confidence) → `reps.content_score` (as `finalContentScore`)

- **From coaching JSON:**  
  - `parsed.feedback_good` → `reps.feedback_good`  
  - `parsed.feedback_improve` → `reps.feedback_improve`  
  - `parsed.next_focus` → `reps.next_focus`

- **Fixed:**  
  - `status` → `reps.status` set to `"completed"`.

**5.2 Delivery sub-scores → `delivery_scores`**

- `delivery.pace` → `delivery_scores.pace`
- `delivery.clarity` → `delivery_scores.clarity`
- `delivery.filler_words` → `delivery_scores.filler_words`
- `delivery.confidence` → `delivery_scores.confidence`
- `delivery.pauses` → `delivery_scores.pauses`
- `delivery.tone` → `delivery_scores.tone`
- `delivery.overall_delivery` → `delivery_scores.overall_delivery`  
  (All normalized with `num(...)`.)

**Exact code that performs the updates:**

```ts
const { error: repUpdateError } = await supabase
  .from("reps")
  .update({
    transcript,
    transcript_word_count: transcriptWordCount,
    overall_score: overallScore,
    delivery_score: deliveryScore,
    content_score: finalContentScore,
    status: "completed",
    feedback_good: feedbackGood,
    feedback_improve: feedbackImprove,
    next_focus: nextFocus,
  })
  .eq("id", repId)
```

```ts
const { error: deliveryUpsertError } = await supabase
  .from("delivery_scores")
  .upsert(
    {
      rep_id: repId,
      pace: num(delivery.pace),
      clarity: num(delivery.clarity),
      filler_words: num(delivery.filler_words),
      confidence: num(delivery.confidence),
      pauses: num(delivery.pauses),
      tone: num(delivery.tone),
      overall_delivery: deliveryScore,
    },
    { onConflict: "rep_id" }
  )
```

---

## 6. Cost Estimate Per Rep

**Assumptions:** One rep, ~60 seconds of audio, transcript ~150 words (~200 tokens). Pricing references: Whisper ~$0.006/min; gpt-4o-mini ~$0.15/1M input, ~$0.60/1M output (approximate list prices).

| Step | Input | Output | Approx. tokens | Approx. cost |
|------|--------|--------|----------------|--------------|
| **Transcription** | 1 min audio | — | — | ~$0.006 |
| **Scoring call** | System ~200 + user (transcript) ~200 | JSON ~150 | In ~400, Out ~150 | In ~$0.00006, Out ~$0.00009 → ~$0.00015 |
| **Coaching call** | System ~400 + user ~5 | JSON ~80 | In ~405, Out ~80 | In ~$0.00006, Out ~$0.00005 → ~$0.00011 |

**Total per rep (approximate):** ~\$0.0063 (transcription dominates).  
For a 90s rep and longer transcript (e.g. 300 tokens), scoring/coaching might add ~\$0.0005; total still on the order of **~\$0.007 per rep**. Actual cost depends on audio length and token usage.

---

## 7. Weaknesses in Current Prompt Design

1. **Vague instructions**  
   The scoring prompt says “evaluate executive communication quality” and “Scores are 0-100” but does not define what “executive communication quality,” pace, clarity, filler words, tone, structure, brevity, etc. mean. Different reps can be scored with different mental rubrics, so scores may be inconsistent across runs and users.

2. **No explicit rubric**  
   There is no shared scale (e.g. what 70 vs 90 means, or what “good” pace/clarity is). The model infers criteria, which increases variance and makes it hard to justify or improve scores systematically.

3. **Inconsistent scoring**  
   No temperature or seed is set for the scoring call, so the same transcript can yield slightly different scores on retries. The lack of criteria and examples amplifies this.

4. **Lack of examples**  
   Neither the scoring nor the coaching prompt includes few-shot examples (e.g. “For a transcript like X, output scores Y” or “For this scenario, good feedback looks like Z”). That increases reliance on model defaults and can make feedback style and calibration drift.

5. **Scoring prompt has no context**  
   The scoring model sees only the transcript. It does not see vertical, scenario, audience, or framework, so it cannot align scores with the intended use case (e.g. “elevator pitch” vs “technical deep-dive”). Content/structure scores may be generic rather than scenario-specific.

6. **Hallucination / over-interpretation risk**  
   With minimal instructions, the model may infer meaning or intent not clearly in the transcript (e.g. “confidence” from tone) or invent details. No instruction to “only use information present in the transcript” or to flag unclear segments.

7. **Coaching user message is trivial**  
   The coaching user message is fixed: “Generate the feedback JSON.” All real signal is in the system prompt. This is workable but redundant and could be merged into a single system instruction or a more descriptive user message for clarity.

8. **No validation of score ranges**  
   Parsed numbers are normalized with `num()` but not clamped to 0–100. If the model returns 150 or -10, those values can be stored unless DB constraints or later code enforce bounds.

9. **Filler words as a “score”**  
   `filler_words` is in the delivery object and stored as a number. The prompt does not specify whether it is a count or a 0–100 score, which can confuse the model and lead to inconsistent semantics in `delivery_scores`.

10. **Failure mode for coaching**  
    If the coaching call fails or returns invalid JSON, all coaching fields are set to `null` and the rep is still marked “completed.” The user gets scores but no text feedback, with no explanation or retry in this function.

---

## Output Summaries

### Full pipeline diagram

```
[Client] invoke score-rep(repId)
    ↓
[Edge] Load rep (reps.*), idempotency check, atomic claim (status → processing)
    ↓
[Edge] Resolve audio path, download from rep-audio bucket → File(webm)
    ↓
[OpenAI] Whisper: audio → transcript (model: whisper-1)
    ↓
[Edge] transcript, transcriptWordCount (from transcript)
    ↓
[OpenAI] Scoring: systemPrompt + transcript → JSON (overall_score, delivery.*, content.*)
    ↓
[Edge] Parse JSON → overallScore, deliveryScore, finalContentScore, delivery.*
    ↓
[OpenAI] Coaching: coachingSystemPrompt (context + transcript) + "Generate the feedback JSON." → JSON (feedback_good, feedback_improve, next_focus)
    ↓
[Edge] Parse coaching JSON → feedbackGood, feedbackImprove, nextFocus (or null on error)
    ↓
[Edge] reps.update(transcript, transcript_word_count, overall_score, delivery_score, content_score, status=completed, feedback_good, feedback_improve, next_focus)
    ↓
[Edge] delivery_scores.upsert(rep_id, pace, clarity, filler_words, confidence, pauses, tone, overall_delivery)
    ↓
[Edge] return 200 { success: true }
```

### Prompt texts (concise)

- **Scoring system:** “You evaluate executive communication quality. Return STRICT JSON only…” with the JSON shape (overall_score, delivery.*, content.*), “Scores are 0-100. Return only valid JSON.”
- **Scoring user:** Raw transcript only.
- **Coaching system:** “You are a high-performance communication coach.” + context (Vertical, Scenario, Audience, Framework, Overall/Delivery/Content scores) + “Transcript: <full transcript>” + JSON shape (feedback_good, feedback_improve, next_focus) + “No extra commentary. No markdown. Be specific to the scenario and audience. Avoid generic praise.”
- **Coaching user:** “Generate the feedback JSON.”

### Database mapping (concise)

- **reps:** transcript, transcript_word_count ← Whisper; overall_score, delivery_score, content_score, status ← scoring; feedback_good, feedback_improve, next_focus ← coaching.
- **delivery_scores:** rep_id, pace, clarity, filler_words, confidence, pauses, tone, overall_delivery ← scoring JSON delivery object.

### Estimated cost per rep

- **Rough total:** ~\$0.006–0.007 per rep (Whisper ~\$0.006 for 1 min; scoring + coaching a few tenths of a cent).
- Depends on audio length and transcript length; transcription dominates.

### Weaknesses (short list)

- Vague scoring instructions and no rubric.
- No few-shot examples in scoring or coaching.
- Scoring gets no scenario/audience/framework context.
- Possible score inconsistency (no temperature/seed; no range validation).
- Ambiguous or overloaded fields (e.g. filler_words as count vs score).
- Coaching failure leaves feedback null with no user-facing explanation or retry.
