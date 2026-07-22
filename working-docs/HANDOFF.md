# Machine handoff — restoring Cognify on a new laptop

Written 2026-07-22, before returning the Street Diligence laptop. Everything below was
previously local-only; it is now in the repo so a fresh `git clone` is sufficient.

## Restore checklist

1. `git clone https://github.com/maxvolkov202/Cognify-Product-Description.git cognify`
2. `npm install`
3. **Secrets.** `npm i -g vercel && vercel login && vercel link` (project `cognify-v2`),
   then `vercel env pull .env.local`. `.env.example` at the repo root documents every key
   and which ones are required. Nothing secret is stored in git.
4. **Claude memory.** Copy `working-docs/claude-memory/*.md` to
   `~/.claude-personal/projects/<project-slug>/memory/` on the new machine. The slug is
   derived from the checkout path (on the old laptop: `C--Users-MaxVolkov-dev-cognify`),
   so it will differ if you clone to a different directory. `MEMORY.md` is the index.
5. **Local dev scripts.** `working-docs/local-scripts/` holds the audit/debug/seed scripts
   that were gitignored. Copy back to `scripts/` if you want them at their original paths.
6. **Modal prosody worker.** Source is tracked at `infra/prosody-worker/`. Re-auth with
   `pip install modal && modal token new`, then `modal deploy modal_app.py` if it ever
   needs redeploying. It is already deployed and live; the token is only needed to change it.
7. **GitHub CLI.** `gh auth login`. Note: `origin` is Max's fork and `upstream` is Bob's, so
   `gh pr create` / `gh pr merge` must pass
   `--repo maxvolkov202/Cognify-Product-Description` or they target upstream and fail.

## Things that are NOT on this laptop and need nothing

- **cognifygym.com** keeps serving the last production deploy regardless of this machine.
  The domain is registered at GoDaddy (apex A -> 216.198.79.1, `www` primary) and points at
  the `cognify-v2` Vercel project. No action needed on handoff.
- **Supabase / Vercel / Modal / Anthropic / OpenAI / Deepgram accounts** are all cloud-side
  and tied to Max's personal accounts, not to this hardware.

## Deploy mechanics (easy to forget)

The `cognify-v2` Vercel project is **not** git-linked. Pushing to `main` does not deploy.
Production deploys are manual from a local checkout:

```
vercel deploy --prod
```

which auto-aliases `cognify-v2-neon.vercel.app` and `cognifygym.com` (no manual repoint).

## What's in working-docs/

| Folder | Contents |
| --- | --- |
| `design/` | UI redesign specs — homepage, recording screen, configuration flow, framework workspace, evaluation system v2, grading system |
| `reports/` | Rep-lifecycle technical report; canon audit results (2026-07-15) |
| `figma-make-export/` | Leftovers from the Figma Make prototype (`index.html`, `Guidelines.md`, `ATTRIBUTIONS.md`). This is a separate Vite prototype, **not** the Next.js app. Its `dist/` build output was intentionally not archived. |
| `local-scripts/` | Previously-gitignored audit/debug/probe/seed scripts. Verified free of hardcoded secrets before committing. |
| `claude-memory/` | Snapshot of Claude Code's project memory (see step 4). |

These are working references, not part of the running app. Nothing in `working-docs/` is
imported by application code.
