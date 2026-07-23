# Framework Workspace

## Overview

The **Framework Workspace** is a structured thinking tool that appears on the recording screen. It provides **optional mental cue cards** to help users organize their thoughts before and during speaking practice.

**This is NOT a script.**  
**This is structured thinking scaffolding.**

---

## Core Principles

1. **Optional** — Users can leave all fields blank with no penalty
2. **Keywords only** — 100 character limit prevents full sentences
3. **Locks when recording starts** — Maintains realistic training pressure
4. **Light guardrails** — Guides thinking without scripting
5. **Hidden during playback** — Only visible during preparation and recording

---

## How It Works

### Before Recording (Unlocked State)

When a user selects a framework (e.g., Problem → Impact → Solution), the workspace displays:

```
🧱 Framework Workspace
Problem → Impact → Solution

Optional thinking prompts: Use keywords to structure your thoughts.
These lock when recording starts—not a script to read.

1 Problem
  [Key issue                                    ]

2 Impact
  [Who's affected & why it matters              ]

3 Solution
  [What you recommend                           ]
```

**User can:**
- Fill in keyword prompts
- Leave fields empty
- Edit freely

### During Recording (Locked State)

Once the user clicks "Start Recording":
1. **3-second countdown begins** → Fields lock immediately
2. **Recording starts** → Workspace remains visible but read-only
3. **Lock icon appears** → Visual indicator that editing is disabled

**User can:**
- View their keywords as mental cue cards
- Reference them while speaking
- **NOT** edit or add new keywords (prevents scripting mid-rep)

### After Recording

The workspace is **hidden** during:
- Processing screen
- Feedback screen
- Transcript review

---

## Character Limit & Validation

**Maximum: 100 characters per field**

**Why this limit?**
- Prevents full sentence scripting
- Forces concise, keyword-based thinking
- Encourages real-time synthesis during speech
- Maintains "under pressure" training realism

**Live character counter:**
- Appears when typing
- Turns orange at 100/100
- Hard caps input at 100 characters

---

## Placeholder Examples

### Problem → Impact → Solution
- Problem: "Key issue"
- Impact: "Who's affected & why it matters"
- Solution: "What you recommend"

### Situation → Action → Result
- Situation: "Context & challenge"
- Action: "What you did"
- Result: "Measurable outcome"

### Context → Insight → Recommendation
- Context: "Background"
- Insight: "Key finding"
- Recommendation: "Next step"

---

## UI States

### 1. Ready State (Before Recording)
- **Border:** Purple (active)
- **Background:** White
- **Inputs:** Enabled
- **Hint:** Blue/purple gradient banner with guidance

### 2. Locked State (During Recording)
- **Border:** Gray (inactive)
- **Background:** Gray 50
- **Inputs:** Disabled
- **Lock icon:** Visible in header
- **Reminder:** "Use these as mental cue cards—not a script to read"

### 3. Hidden State (After Recording)
- Workspace not rendered
- Clean feedback/transcript view

---

## Visual Design

**Matches Cognify's aesthetic:**
- Gradient purple branding (#5CB3FF → #9D7BF5 → #E86DE1)
- Clean, minimal layout
- Subtle borders (no heavy UI clutter)
- Soft backgrounds
- Plenty of whitespace

**Accessibility:**
- Labels for screen readers
- Focus states on inputs
- Color-coded feedback (character count)
- Clear disabled state styling

---

## Product Decision: Lock on Recording Start

**Decision:** Fields lock when recording starts (Option A)

**Why?**
1. **Maintains realistic pressure** — Real communication doesn't allow mid-speech editing
2. **Forces preparation** — Users must think ahead
3. **Prevents teleprompter mode** — Can't write a script while talking
4. **Training integrity** — Mimics real high-stakes scenarios

**Alternative (rejected for MVP):**
- Allow editing during recording
- Would undermine "under pressure" training value
- Reduces authenticity of practice environment

---

## Integration Points

### Component: `FrameworkWorkspace.tsx`

**Props:**
- `frameworkName: string` — Display name (e.g., "Problem → Impact → Solution")
- `frameworkSteps: string[]` — Array of step names (e.g., ["Problem", "Impact", "Solution"])
- `isRecording: boolean` — True when actively recording or paused
- `isLocked: boolean` — True when fields should be disabled

**Usage in `RecordingArea.tsx`:**

```tsx
<FrameworkWorkspace
  frameworkName={selectedFramework.name}
  frameworkSteps={selectedFramework.structure}
  isRecording={recordingState === "recording" || recordingState === "paused"}
  isLocked={recordingState === "countdown" || recordingState === "recording" || recordingState === "paused" || recordingState === "processing"}
/>
```

**Visibility logic:**
- Shows when: `recordingState` is "ready", "countdown", "recording", or "paused"
- Hidden when: `recordingState` is "processing"
- Never shows for "free-form" framework (structure.length === 0)

---

## User Benefits

### 1. Reduces Freezing
Users have a mental roadmap → less blank-mind moments

### 2. Improves Structure Execution
Clear framework steps → better adherence to structure

### 3. Builds Confidence
Pre-planned keywords → less anxiety about "what to say next"

### 4. Cleaner Thinking
Forces distillation into keywords → clearer mental organization

### 5. Training Data Insight
**If user fills bullets but still misses structure → reveals execution gap, not planning gap**

This diagnostic insight is valuable for coaching feedback.

---

## Future Enhancements (Post-MVP)

### Auto-highlight Current Section
- Highlight "Problem" step when user is likely on that section
- Uses timing heuristics (e.g., first 30% of time = Problem)
- Subtle visual cue without aggressive UI

### Framework Coverage Heat Map
- After feedback, show which bullets were "covered" in speech
- Green checkmark if mentioned, gray if skipped
- Helps users see gaps between plan and execution

### Voice-to-Keyword Extraction
- After first rep, suggest keywords based on what user actually said
- Pre-fill workspace for rep #2 with distilled keywords from rep #1
- Speeds up iteration loop

### Mobile Optimization
- Collapsible workspace on small screens
- Swipe to expand/collapse during recording
- Bottom sheet UI pattern

---

## Anti-Patterns to Avoid

❌ **Don't make it required**  
✅ Fields are optional—blank is fine

❌ **Don't encourage full sentences**  
✅ 100-char limit enforces brevity

❌ **Don't allow editing during recording**  
✅ Lock on countdown start

❌ **Don't make it feel like a form**  
✅ Minimal, clean design

❌ **Don't show during playback**  
✅ Hide after recording completes

---

## Success Metrics

**Adoption:**
- % of users who fill at least one field
- Average fields filled per rep
- % of reps with 0 fields vs. all fields filled

**Impact:**
- Structure score improvement (workspace users vs. non-users)
- Filler word reduction (workspace users vs. non-users)
- Framework coverage % (workspace users vs. non-users)

**Engagement:**
- Do users fill more fields on rep #2 than rep #1?
- Do workspace users complete more reps per session?

---

## Example User Flow

**User selects:** "Explain a recent project decision" + "Executive team" + "Problem → Impact → Solution" + "90s"

**Before recording:**
1. Workspace appears with 3 fields unlocked
2. User types:
   - Problem: "migration blocking Q3 launch"
   - Impact: "3 teams waiting, $2M revenue risk"
   - Solution: "fast-track option, cut scope 30%"
3. User clicks "Start Recording"

**During countdown (3s):**
- Fields lock
- Lock icon appears
- User can still read their keywords

**During recording:**
- Timer counts down from 90s
- Workspace stays visible
- User glances at keywords while speaking
- **Cannot edit** (realistic pressure maintained)

**After recording:**
- Workspace hidden
- User sees processing screen
- Then feedback with structure analysis

**Result:**
- Structure score: 82 (strong adherence)
- Specificity score: 75 (metrics mentioned: "$2M", "30%")
- **Insight:** Workspace helped execution match plan

---

## Technical Implementation

**State management:**
- Component-local state (no global persistence needed for MVP)
- `bulletInputs` object: `{ [stepName]: string }`
- `charCounts` object: `{ [stepName]: number }`

**Locking mechanism:**
- CSS `disabled` attribute on inputs
- Visual state changes (gray background, gray text)
- `cursor-not-allowed` on disabled inputs

**Character validation:**
- `maxLength` HTML attribute (hard cap)
- JavaScript validation: `value.length <= MAX_CHARS`
- Live counter updates on `onChange`

---

**This makes Cognify's "deliberate practice" more structured without sacrificing authenticity.**

Users get **just enough scaffolding** to organize thoughts, but the pressure of real-time performance remains intact.
