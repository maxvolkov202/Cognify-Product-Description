# _inbox — raw reference drop folder

Drop YouTube transcripts, PDFs, articles, meeting notes, or any other reference material here. Cognify's knowledge pipeline will read from this folder and distill the relevant signals into `src/lib/ai/knowledge/`.

## How it works

1. You drop files here in any format — `.txt`, `.md`, `.pdf`, `.vtt`, raw YouTube transcript dumps, anything.
2. Claude reads them, extracts the pedagogically-useful signals, and writes distilled `.md` files into `src/lib/ai/knowledge/domains/` or `knowledge/patterns/`.
3. Files in `_inbox/` are **not** loaded into Claude at runtime — only the distilled `knowledge/*.md` files are. This folder is the raw source bin, not the production knowledge base.

## What to drop here

- YouTube transcripts on cold calling, exec presence, feedback, interviewing, storytelling, persuasion, or communication more broadly
- Articles from practitioners (Gong, 30MPC, pclub.io, Higher Levels, Josh Braun, etc.)
- PDFs of relevant books or research papers
- Your own notes or transcribed meetings
- Anything else that would make Cognify's scoring or framework generation smarter

## What does NOT belong here

- Application code
- User data
- Secrets or API keys
- Anything that should be committed to a public repo

## Gitignore

This folder is gitignored by default — source material stays local, and copyrighted content never ends up in version control. The distilled `.md` files under `src/lib/ai/knowledge/` are safe to commit because they are original synthesis with attributed sources.

## Suggested naming

Drop files with a prefix so it's clear what they are:

```
cold-call_connor-murray_higher-levels_ep47.txt
exec-comms_chris-orlob_c-suite-challenge.md
feedback_kim-scott_radical-candor-interview.txt
research_gong-cold-call-data-2025.pdf
```

No hard rules — just makes the distillation pass faster.
