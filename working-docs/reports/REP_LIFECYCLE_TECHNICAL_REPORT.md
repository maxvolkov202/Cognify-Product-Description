# Cognify Rep Lifecycle — Technical Report

**Scope:** Full rep lifecycle from recording through feedback display. No code was changed; findings only.

---

## 1. Training Flow Entry (Recording)

### File responsible for starting a recording
- **Primary:** `src/app/v2/components/tryitout/RecordingArea.tsx`
  - User flow: **TryItOut2** (`src/app/v2/TryItOut2.tsx`) at routes `/app/rep` and `/app/try-it-out-v2` → **RecordingArea** when view state is `"recording"`.
  - Recording is started in `RecordingArea` via **Start Recording** button → `handleStartRecording()` → countdown (3s) → `startRecording()` from `useAudioRecorder()`.
- **Legacy (not routed in current app):** `src/app/TryItOut.tsx` exists and has its own recording/upload/insert flow but is not mounted under any route; only TryItOut2 is used at `/app/rep`.

### Library used for audio recording
- **MediaRecorder (browser API)** via custom hook **`useAudioRecorder`** in `src/app/v2/hooks/useAudioRecorder.ts`.
  - Uses `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })` and `new MediaRecorder(stream)`.
  - Chunks collected in memory; on stop, a single `Blob` (e.g. `audio/webm`) is built and returned. No third-party recording library.

### Max duration enforcement (≤90s)
- **Enforcement:** In `RecordingArea`, a countdown `timeRemaining` is initialized from `timeConstraint` (prop) and decremented every second while `recordingState === "recording"`. When `timeRemaining === 0`, `handleStopRecording()` is called automatically (effect around lines 127–139).
- **Source of limit:** `timeConstraint` is set in **ScenarioSelection** (`src/app/v2/components/tryitout/ScenarioSelection.tsx`): user chooses one of **30, 60, or 90 seconds** (line 126: `[30, 60, 90].map(...)`). So **max duration is 90s** by UI constraint; there is no separate server-side or hook-level cap.
- **Minimum:** `MIN_RECORDING_DURATION = 15` seconds in `RecordingArea.tsx`; shorter recordings trigger `onFailure("too-short")`.

---

## 2. Rep Creation

### File + function creating the rep
- **File:** `src/app/v2/components/tryitout/RecordingArea.tsx`
- **Function:** `handleStopRecording` (async callback, starts ~line 173).

### Exact Supabase call
```ts
const { data: insertedRep, error: insertError } = await supabase
  .from("reps")
  .insert({
    user_id: session.user.id,
    audio_url: storagePath,
    status: "pending",
    vertical,
    scenario,
    audience,
    framework,
    time_limit: timeConstraint,
  })
  .select("id")
  .single();
```

### Columns inserted
| Column       | Value / source                                      |
|-------------|------------------------------------------------------|
| `user_id`   | `session.user.id`                                   |
| `audio_url` | `storagePath` (path string, see §3)                  |
| `status`    | `"pending"`                                         |
| `vertical`  | prop                                                |
| `scenario`  | prop                                                |
| `audience`  | prop                                                |
| `framework` | prop                                                |
| `time_limit`| `timeConstraint` (30 | 60 | 90)                     |

- **audio_url vs storage_path:** The column name is **`audio_url`** but the value stored here is the **storage path** (e.g. `{userId}/{Date.now()}.webm`), not a full URL. The edge function and ResultsScreen treat it as path when fetching/creating signed URLs.
- **Status column:** Yes. `status` is set to `"pending"` on insert; the edge function updates it to `"processing"` then `"completed"` or `"failed"`.

**Note:** The legacy `TryItOut.tsx` flow (upload → insert rep with signed URL in `audio_url` → insert placeholder `delivery_scores` → invoke `score-rep`) is not used by current routes.

---

## 3. Audio Upload

### Storage bucket name
- **`rep-audio`**

### Upload method
- **Supabase Storage upload:** `supabase.storage.from("rep-audio").upload(storagePath, blob, { contentType: "audio/webm" })`.
- Called in `RecordingArea.handleStopRecording` after getting the blob from `stopRecording()`.

### File naming scheme
- **Pattern:** `{userId}/{Date.now()}.webm`
- Example: `a1b2c3-uuid/1709123456789.webm`

### Upload vs rep row creation order
- **Upload happens first**, then the rep row is inserted.
  1. Upload to `rep-audio` with path `{userId}/{Date.now()}.webm`.
  2. Insert into `reps` with `audio_url: storagePath` and `status: "pending"`.
  3. Invoke edge function `score-rep` with `repId`.

---

## 4. Processing Trigger

### Mechanism
- **Explicit client invocation** of the Edge Function after rep insert. No database trigger or background job observed.

### Edge function name
- **`score-rep`**

### File location
- **`supabase/functions/score-rep/index.ts`**

### Parameters passed
- **Body:** `{ repId: string }` (the id returned from the rep insert).
- Example: `supabase.functions.invoke("score-rep", { body: { repId: insertedRep.id } })`.

### Other edge function (not in main flow)
- **`supabase/functions/analyze-rep/index.ts`** exists and accepts multipart form (audio, framework, audience, scenario, preRepIntent) but returns a **mock** transcript and analysis. It is **not** invoked from RecordingArea or TryItOut2; the production flow uses only **`score-rep`**.

---

## 5. Edge Function Logic (score-rep)

**File:** `supabase/functions/score-rep/index.ts`

### Steps inside the function
1. **Parse body** for `repId`; return 400 if missing.
2. **Create Supabase client** with service role.
3. **Load rep row** from `reps` by `id`; return 404 if not found.
4. **Set status** to `"processing"`: `reps.update({ status: "processing" }).eq("id", repId)`.
5. **Resolve audio path:** `rep.audio_url` may be a full URL (legacy) or a path; if URL, strip to path after `rep-audio/`.
6. **Fetch audio:** `supabase.storage.from("rep-audio").download(filePath)` → arrayBuffer → `File` (audio/webm).
7. **Transcription:** **OpenAI Whisper** — `openai.audio.transcriptions.create({ model: "whisper-1", file })`.
8. **Scoring (GPT):** **OpenAI Chat** — `openai.chat.completions.create` with **model `gpt-4o-mini`**, system prompt asking for strict JSON (overall_score, delivery.*, content.*), `response_format: { type: "json_object" }`.
9. **Coaching feedback (GPT):** Second `gpt-4o-mini` call with transcript + context (vertical, scenario, audience, framework, scores), response format JSON with `feedback_good`, `feedback_improve`, `next_focus`.
10. **Update rep row:** `reps.update({ transcript, transcript_word_count, overall_score, delivery_score, content_score, status: "completed", feedback_good, feedback_improve, next_focus }).eq("id", repId)`.
11. **Upsert delivery_scores:** `delivery_scores.upsert({ rep_id, pace, clarity, filler_words, confidence, pauses, tone, overall_delivery }, { onConflict: "rep_id" })`.
12. On any processing error, set `reps.status` to `"failed"`.

### rep_feedback table
- There is **no `rep_feedback` table** in this codebase. Feedback is stored on **`reps`** (`feedback_good`, `feedback_improve`, `next_focus`) and in **`delivery_scores`** (dimension scores). The migration `20260222_add_rep_feedback_columns.sql` only adds columns to **`reps`**.

### Fields written to reps (by score-rep)
- `transcript`, `transcript_word_count`, `overall_score`, `delivery_score`, `content_score`, `status` (`"completed"`), `feedback_good`, `feedback_improve`, `next_focus`.

### Fields written to delivery_scores
- `rep_id`, `pace`, `clarity`, `filler_words`, `confidence`, `pauses`, `tone`, `overall_delivery` (upsert on `rep_id`).

---

## 6. Feedback Schema

**Note:** No `rep_feedback` table exists. Feedback lives on `reps` and in `delivery_scores`. Schema below is inferred from code and the single migration in the repo; base table definitions (e.g. `CREATE TABLE`) were not found in the repo.

### reps (inferred)
| Column                | Inferred type / notes                    |
|-----------------------|------------------------------------------|
| id                    | uuid (PK)                                |
| user_id               | uuid                                     |
| audio_url             | text (path or URL)                       |
| status                | text ("pending" \| "processing" \| "completed" \| "failed") |
| vertical              | text                                     |
| scenario              | text                                     |
| audience              | text                                     |
| framework             | text                                     |
| time_limit            | int                                      |
| transcript            | text (set by score-rep)                  |
| transcript_word_count | int                                      |
| overall_score         | numeric                                  |
| delivery_score        | numeric                                  |
| content_score         | numeric                                  |
| feedback_good         | text (migration)                         |
| feedback_improve      | text (migration)                          |
| next_focus            | text (migration)                         |
| created_at            | timestamptz (assumed)                    |

- **Migration:** `supabase/migrations/20260222_add_rep_feedback_columns.sql` adds `feedback_good`, `feedback_improve`, `next_focus` to `public.reps`. Indexes/FKs on `reps` not present in repo.

### delivery_scores (inferred)
| Column           | Inferred type / notes   |
|------------------|-------------------------|
| rep_id           | uuid (unique for upsert)|
| pace             | numeric                 |
| clarity          | numeric                 |
| filler_words     | numeric                 |
| confidence       | numeric                 |
| pauses           | numeric                 |
| tone             | numeric                 |
| overall_delivery | numeric                 |

- **Upsert:** `onConflict: "rep_id"` in score-rep implies unique constraint (or PK) on `rep_id`. Foreign key to `reps(id)` is plausible but not confirmed in repo.

### rep_feedback
- **Not present.** All feedback is on `reps` and `delivery_scores`.

---

## 7. Feedback Retrieval (/app/rep/:id)

- The **detail route** is **`/app/reps/:id`** (not `/app/rep/:id`). Defined in `App.tsx`: `<Route path="reps/:id" element={<RepDetailPage />} />`.

### File path
- **`src/app/pages/RepDetailPage.tsx`**

### Supabase query
- Single load in `useEffect` when `id` and `session?.user?.id` are set:
```ts
const { data, error } = await supabase
  .from("reps")
  .select(`
    id, transcript, transcript_word_count, overall_score, delivery_score, content_score,
    status, audio_url, vertical, scenario, audience, framework, time_limit, created_at,
    feedback_good, feedback_improve, next_focus,
    delivery_scores (*)
  `)
  .eq("id", id)
  .eq("user_id", session.user.id)
  .single();
```

### Behavior
- **Loads once** on mount; **no polling**, **no subscription**. If status is `"processing"`, the page shows “Still Processing” and does not refetch; user must refresh or navigate away and back to see updated feedback.

---

## 8. Polling / Processing State

### Where polling is used
- **`src/app/v2/components/tryitout/ResultsScreen.tsx`** (used right after completing a rep in TryItOut2):
  - When `repId` is set, a recursive `poll()` runs: selects the rep by id; if `status === "completed"`, fetches `delivery_scores` and stops; if `status === "failed"`, sets error and stops; otherwise **`setTimeout(poll, 2000)`** (poll again in 2s).
  - So **polling interval is 2 seconds** until completed or failed.

### Loading states
- **ResultsScreen:** `loading` or `rep?.status === "processing"` → spinner and “Scoring your rep...”.
- **RepDetailPage:** Single load; if `rep.status === "processing"` → “Still Processing” (no auto-refresh).
- **RecordingArea:** `recordingState === "stopping"` → “Analyzing your rep...”; then parent moves to submitting/analyzing/results views.

### Realtime (subscription)
- **AppLayout** subscribes to **Supabase Realtime** for list updates only:
  - Channel: `"reps-header-updates"`.
  - `postgres_changes` on `public.reps`, event `INSERT`, filter `user_id=eq.{userId}`.
  - On event, it refetches a lightweight list (`id`, `created_at`) for header/stats. It does **not** subscribe for status updates on a single rep.

### Summary
- **After recording (same session):** ResultsScreen **polls** every 2s until feedback is ready.
- **On rep detail page:** **No polling**; single load; processing state requires manual refresh.
- **Header rep count:** Realtime INSERT on `reps` triggers refetch; no polling for count.

---

## 9. Zustand Stores

- **No Zustand** is used in the rep flow. Searches for `createStore`, `zustand`, `useStore` under `src` returned no matches.
- **State is handled by:**
  - **React Context:** `RepsContext` (`src/context/RepsContext.tsx`) — exposes `repHistory` and `refetchReps`; used by App and AppLayout.
  - **Local React state** in TryItOut2, RecordingArea, ResultsScreen, RepDetailPage, etc. (e.g. `viewState`, `repHistory`, `currentRepId`, `rep`, `loading`).

### Rep-related context (no Zustand)
| Name          | Location              | Key state / actions                         |
|---------------|------------------------|---------------------------------------------|
| RepsContext   | src/context/RepsContext.tsx | `repHistory: Rep[]`, `refetchReps()`; fetches reps + delivery_scores for user. |

---

## 10. Known Technical Risks

1. **RepDetailPage does not poll or subscribe**  
   If the user opens `/app/reps/:id` while the rep is still `"processing"`, they see “Still Processing” and must refresh or re-enter to see results. ResultsScreen (post-recording) polls, but the detail page does not.

2. **Race / duplicate processing**  
   The client invokes `score-rep` once after insert. If the user double-submits or the UI fires twice, two invocations could run for the same rep. There is no idempotency key or “processing” lock in the client; the edge function does set status to `"processing"` before work, but concurrent invocations could both pass the initial read and run in parallel (double Whisper + double GPT usage).

3. **Polling inefficiency**  
   ResultsScreen polls every 2s until completion. For slow runs (e.g. long audio), this can mean many requests. No exponential backoff or max attempts; cancellation is only on unmount via a `cancelled` flag.

4. **Cost and reliability (OpenAI)**  
   Each rep uses: one Whisper call, two gpt-4o-mini calls (scoring + coaching). No retries or fallbacks in the edge function; a single API failure marks the rep as `"failed"` and the user sees an error. Cost scales linearly with rep count and audio length (Whisper).

5. **audio_url meaning and RepDetailPage playback**  
   RecordingArea stores the **storage path** in `audio_url`. ResultsScreen creates a **signed URL** from that path for playback. RepDetailPage uses `rep.audio_url` directly as `<audio src={rep.audio_url}>`. If `audio_url` is a path (v2 flow), playback on the detail page may fail unless the backend or RLS serves that path as a URL. Inconsistent semantics (path vs URL) across flows.

6. **Schema and indexes**  
   No schema files in the repo define indexes or FKs. High traffic on `reps(user_id)`, `reps(status)`, and `delivery_scores(rep_id)` would benefit from appropriate indexes; their absence is a potential performance risk.

---

## Output Summaries

### Rep lifecycle diagram (high level)
```
[User] → Start Recording (RecordingArea)
    → useAudioRecorder (MediaRecorder) → countdown → record (max 90s from timeConstraint)
    → Stop → blob
    → 1) Upload to rep-audio bucket (path: userId/timestamp.webm)
    → 2) Insert reps row (audio_url=path, status=pending)
    → 3) supabase.functions.invoke("score-rep", { body: { repId } })
[Edge] score-rep
    → reps.status = "processing"
    → Download audio from rep-audio
    → Whisper → transcript
    → GPT-4o-mini (scoring JSON) → GPT-4o-mini (coaching JSON)
    → Update reps (transcript, scores, feedback_*, status=completed)
    → Upsert delivery_scores
[Client] ResultsScreen (when repId set)
    → Poll reps every 2s until status completed/failed
    → Fetch delivery_scores when completed
    → Show feedback
[Client] RepDetailPage (/app/reps/:id)
    → Single select reps + delivery_scores (*)
    → No polling; processing = static "Still Processing"
```

### File map of relevant code
| Role                    | File(s) |
|-------------------------|--------|
| Recording entry        | `src/app/v2/TryItOut2.tsx`, `src/app/v2/components/tryitout/RecordingArea.tsx` |
| Audio recording        | `src/app/v2/hooks/useAudioRecorder.ts` |
| Time limit (90s)        | `src/app/v2/components/tryitout/ScenarioSelection.tsx` (30/60/90), `RecordingArea.tsx` (timer) |
| Rep insert + upload    | `src/app/v2/components/tryitout/RecordingArea.tsx` |
| Invoke score-rep       | `src/app/v2/components/tryitout/RecordingArea.tsx` |
| Edge function          | `supabase/functions/score-rep/index.ts` |
| Polling for feedback    | `src/app/v2/components/tryitout/ResultsScreen.tsx` |
| Rep detail (load once)  | `src/app/pages/RepDetailPage.tsx` |
| Realtime (reps list)   | `src/app/layouts/AppLayout.tsx` |
| Rep list context       | `src/context/RepsContext.tsx` |
| Legacy (unused route)   | `src/app/TryItOut.tsx` |
| Mock edge function     | `supabase/functions/analyze-rep/index.ts` |

### Supabase schema summary
- **reps:** id, user_id, audio_url, status, vertical, scenario, audience, framework, time_limit, transcript, transcript_word_count, overall_score, delivery_score, content_score, feedback_good, feedback_improve, next_focus, created_at (and any other columns not seen in code). No `rep_feedback` table.
- **delivery_scores:** rep_id (unique), pace, clarity, filler_words, confidence, pauses, tone, overall_delivery. Upsert by `rep_id`.
- **Storage:** Bucket `rep-audio`; path `{userId}/{timestamp}.webm`.

### Edge function summary
- **score-rep** (`supabase/functions/score-rep/index.ts`): Receives `{ repId }`, loads rep, sets status processing, downloads audio from `rep-audio`, transcribes (Whisper), scores and generates coaching (gpt-4o-mini × 2), updates `reps` and upserts `delivery_scores`. No separate `rep_feedback` table.

### UI polling behavior
- **ResultsScreen:** Polls `reps` by id every **2 seconds** until `status` is `"completed"` or `"failed"`; then loads `delivery_scores` once.
- **RepDetailPage:** No polling; one-time load. Processing state is static until user refreshes or re-navigates.
- **AppLayout:** Realtime subscription on `reps` INSERT for current user; refetches rep list for header/stats.

### Top 5 architecture risks
1. **No polling or realtime on RepDetailPage** — Users on `/app/reps/:id` during processing must refresh to see results.
2. **Possible duplicate score-rep runs** — No client or server idempotency; double invocations could double OpenAI usage and cause races.
3. **Fixed 2s polling** — Inefficient under load; no backoff or max attempts.
4. **OpenAI cost and failure mode** — Every rep = 1 Whisper + 2 gpt-4o-mini; no retries; single failure marks rep as failed.
5. **audio_url semantics** — Mix of path (v2) and possible URL (legacy); RepDetailPage uses `audio_url` directly as `<audio src>`, which may break for path-only storage.
