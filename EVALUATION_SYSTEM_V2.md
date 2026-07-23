# Executive Communication Evaluator - V2

## Overview

This document describes the **Executive Communication Evaluator**, a strict, behavior-based feedback system that replaces generic encouragement with precise diagnostic analysis.

## Philosophy

**Not a motivational assistant. Not a cheerleader. A performance evaluator.**

- Analytical, specific, and conservative in scoring
- Every statement grounded in observable behavior
- Avoids generic phrases ("good job", "could be clearer", "well done")
- Accelerates deliberate practice through precision

## System Architecture

### Core File: `/src/app/utils/executiveEvaluator.ts`

**Function:** `evaluateExecutiveCommunication(analysis, transcript, framework)`

**Returns:** `ExecutiveFeedback` object with structured dimension analysis

## Feedback Structure

### Per-Dimension Feedback

Each of the 5 dimensions returns:

```typescript
{
  score: number;           // 1-100
  strength: string | null; // Specific observable strength, if present
  weakness: string;        // Specific observable weakness
  reasoning: string;       // One-sentence explanation of score
}
```

### Overall Feedback

```typescript
{
  overallScore: number;              // Weighted average
  overallDiagnostic: string;         // One-sentence summary
  primaryFocus: {
    dimension: string;                // "specificity", "structure", etc.
    instruction: string;              // Specific, actionable, behavior-based
  }
}
```

## Scoring Rules

### Score Bands

| Range   | Classification | Description                           |
|---------|---------------|---------------------------------------|
| 90-100  | Exceptional   | Executive-ready performance            |
| 75-89   | Strong        | Minor refinements needed               |
| 60-74   | Competent     | Noticeable structural/clarity gaps     |
| 40-59   | Developing    | Missing components or lacking specificity |
| <40     | Unclear       | Incomplete or poorly structured        |

### Hard Caps

The system enforces **hard caps** to prevent score inflation:

- **No measurable outcomes** → Specificity capped at 65
- **Missing framework section** → Structure capped at 60
- **Vague/generic claims** → Clarity capped at 65
- **10+ filler words** → Presence capped at 65
- **4+ hedging phrases** → Presence capped at 60
- **Time mismanagement** (< 60 or > 180 words) → Pacing capped at 70

## Five Dimensions

### 1. Clarity (20% weight)

**Question:** Is the main idea obvious and easy to extract?

**Baseline:** 65 (competent)

**Evaluated by:**
- Opening directness (+12 strong / -15 weak)
- Sentence complexity (+8 concise / -12 long)
- Word economy (-15 if < 50 words)
- Repetitive language (-10 if excessive)
- Vague claims (cap at 65 if > 3 generic terms)

**Example Feedback:**
- Strength: "Opened directly without preamble"
- Weakness: "Main idea buried under setup"
- Reasoning: "Score reflects buried opening and complex sentence structure."

### 2. Structure (25% weight)

**Question:** Does the explanation follow a logical progression and adhere to the selected framework?

**Baseline:** 60 (must prove structure)

**Evaluated by:**
- Framework coverage (0-100%)
  - ≥75%: +20 points
  - 50-74%: +10 points
  - <50%: cap at 60
- Opening structure (+8 strong / -10 weak)
- Closing structure (+12 actionable / -18 missing)
- Development (-15 if < 3 sentences)

**Example Feedback:**
- Strength: "Covered 85% of STAR framework"
- Weakness: "Ending lacked next steps or conclusion"
- Reasoning: "Progression lacked clear conclusion; framework coverage was 45%."

### 3. Specificity (25% weight) — HARSHEST GRADER

**Question:** Are claims supported by concrete details or measurable outcomes?

**Baseline:** 50 (must earn it)

**Evaluated by:**
- Metrics/numbers (+25 if present)
- Concrete examples (+12 if present)
- Action verbs (+8 if present)
- Causal links (+10 if present)
- Vague claims (-15 if > 3)
- Business jargon (-12)

**Hard Caps:**
- No metrics AND no examples → cap at 60
- Vague claims without evidence → cap at 65

**Example Feedback:**
- Strength: "Included measurable outcomes"
- Weakness: "No measurable outcome or specific example provided"
- Reasoning: "No metrics; no specific examples."

### 4. Pacing (15% weight)

**Question:** Was time allocated effectively? Was the ending rushed?

**Baseline:** 65

**Evaluated by:**
- Word count sweet spot (100-150 words: +12)
- Too brief (< 50: -25; < 80: -12)
- Too long (> 200: -18; > 180: -10)
- Opening time waste (-10 if weak start)
- Ending rushed (-12 if > 120 words but no close)

**Hard Cap:**
- < 60 or > 180 words → cap at 70

**Example Feedback:**
- Strength: "Used time effectively to develop idea"
- Weakness: "Too brief - key points lacked development"
- Reasoning: "78 words insufficient for depth."

### 5. Presence (15% weight)

**Question:** Did the speaker sound steady, decisive, and controlled?

**Baseline:** 70

**Evaluated by:**
- Filler words
  - 0 fillers: +15
  - 1-2 fillers: +8
  - 3-5 fillers: -12
  - 6-9 fillers: -20
  - 10+ fillers: cap at 65
- Hedging phrases
  - 2-3 hedges: -15
  - 4+ hedges: cap at 60
- Confidence issues (-12)

**Example Feedback:**
- Strength: "No filler words - clean delivery"
- Weakness: "6 filler words weakened delivery"
- Reasoning: "6 filler words; no hedging."

## Overall Score Calculation

```javascript
overallScore = 
  clarity × 0.20 +
  structure × 0.25 +
  specificity × 0.25 +
  pacing × 0.15 +
  presence × 0.15
```

## Overall Diagnostic Logic

**90-100:** "Executive-ready performance with strong structure, concrete outcomes, and confident delivery."

**75-89:** Highlights one major strength + "with minor refinements needed"

**60-74:** "Competent baseline but [lists 1-2 major issues]"

**40-59:** "Developing performance that [lists 1-2 major issues]"

**<40:** "Response unclear with significant structural and delivery issues."

## Primary Focus Selection

**Method:** Find dimension with **lowest weighted impact** (score × weight)

**Output Format:** One specific, actionable, behavior-based instruction

### Examples by Dimension

**Specificity:**
- "State a measurable result in the final 20 seconds"
- "Add a concrete example to support your metric"

**Structure:**
- "End with one specific next step, not a summary"
- "Cover all STAR components - currently missing 35%"

**Clarity:**
- "State your conclusion in the first sentence, not after setup"
- "Break sentences at natural pauses - one idea per sentence"

**Presence:**
- "Pause silently instead of saying 'um' - count to two"
- "Replace 'I think' with direct statements"

**Pacing:**
- "Use the full time - spend 40 seconds developing your core point"
- "Cut the middle 30% - keep only highest-impact details"

## UI Integration

### FeedbackScreen Display

Each dimension shows:
1. **Score** (large, color-coded)
2. **Strength** (green checkmark icon, if present)
3. **Weakness** (orange warning icon, always present)
4. **Reasoning** (italic, smaller text)

### Color Coding

- **75+:** Green (strong)
- **60-74:** Blue (competent)
- **40-59:** Orange (developing)
- **<40:** Red (unclear)

### Primary Focus Card

- **Title:** Dimension name (capitalized)
- **Label:** "Specific instruction:"
- **Content:** The actionable instruction
- **Note:** Rep-specific guidance for improvement reps

## Observable Behavior Examples

### ✅ Good Feedback (Grounded in Behavior)

- "Main idea buried under setup" ← Observable: first sentence was preamble
- "6 filler words weakened delivery" ← Observable: counted fillers
- "No measurable outcome or specific example provided" ← Observable: absence of metrics/examples
- "Ending lacked next steps or conclusion" ← Observable: no action verbs in final sentence

### ❌ Bad Feedback (Generic)

- "Could be clearer" ← Not specific
- "Good job" ← Not analytical
- "Nice explanation" ← Not behavior-based
- "Try to improve" ← Not actionable

## Example Evaluation Flow

**Input Transcript:**
> "So, um, we had this project where we, like, improved the process. It was a good outcome for customers."

**Analysis:**
- Clarity: 52 (weak opening, vague language)
- Structure: 48 (no clear progression)
- **Specificity: 35** (no metrics, all vague claims) ← Lowest impact
- Pacing: 50 (too brief)
- Presence: 65 (2 fillers)

**Overall:** 48 / 100

**Diagnostic:** "Developing performance that lacked measurable outcomes and ended abruptly."

**Primary Focus:** "State a measurable result in the final 20 seconds"

---

**Input Transcript:**
> "We reduced customer churn from 8% to 3.2% in six months. The root cause was slow onboarding—70% of churned customers cited it. I rebuilt the workflow, cutting time-to-value from 45 days to 11 days. This retained $4M in ARR and increased NPS by 22 points. Next, we'll replicate this across EMEA."

**Analysis:**
- Clarity: 95 (immediate, crystal clear)
- Structure: 95 (perfect STAR execution)
- Specificity: 95 (multiple metrics, causal links)
- Pacing: 90 (optimal density)
- Presence: 92 (zero fillers, decisive)

**Overall:** 94 / 100

**Diagnostic:** "Executive-ready performance with strong structure, concrete outcomes, and confident delivery."

**Primary Focus:** "Slow down 10% and emphasize your opening sentence" ← Even at 94, we give actionable guidance

## Key Differences from Previous System

| Aspect | Old System | New System |
|--------|-----------|------------|
| Tone | Encouraging | Analytical |
| Feedback format | Single paragraph | Strength + Weakness + Reasoning |
| Specificity | Generic | Behavior-based |
| Score inflation | Common | Prevented by hard caps |
| Primary focus | Category title | Specific instruction |
| Strengths | Listed separately | Integrated per dimension |
| Observable grounding | Weak | Strong |

## Implementation Files

- **Evaluator:** `/src/app/utils/executiveEvaluator.ts`
- **UI Component:** `/src/app/components/tryitout/FeedbackScreen.tsx`
- **Type Definitions:** `/src/app/types/rep.ts`
- **Analysis Engine:** `/src/app/utils/transcriptAnalyzer.ts`
- **Comparison Logic:** `/src/app/utils/repComparison.ts`

---

This system transforms Cognify from a **supportive coach** into an **elite performance evaluator**.

Users will trust the feedback because it's **tough, fair, and grounded in what they actually said**.
