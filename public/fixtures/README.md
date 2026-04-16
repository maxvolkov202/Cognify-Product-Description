# Cognify fixtures

Static assets used by the tutorial and QA smoke-tests. Kept in `/public` so they ship with the Next.js build.

## `sample-rep.wav`

A 30-second synthesized rep of the Structure framework (Main + 3 + Close) answering "Why is trust the foundation of every relationship?" Used by the `/tutorial` page to let users hear what a well-hit rep actually sounds like before they record their own.

Generated via Windows SAPI (System.Speech) — regenerate with:

```powershell
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SetOutputToWaveFile('public/fixtures/sample-rep.wav')
$s.Rate = -1
$s.Speak('Trust is the foundation of every relationship. And three specific behaviors build it. First, consistency — showing up the same way whether it is easy or hard. Second, honesty about what you do not know, not just what you do. Third, following through: every kept commitment is a deposit; every broken one is a withdrawal. Consistency, honesty, follow-through. That is how trust gets built, in that order.')
$s.Dispose()
```

Synthesized speech is deliberate (no filler, controlled pacing) so it reads as a high-clarity reference — not as a typical user rep.
