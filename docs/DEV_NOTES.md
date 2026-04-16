# Cognify — Dev Notes

Operational instructions for running, restarting, and troubleshooting the Cognify dev environment. Read this when anything feels off.

## Dev server basics

```bash
cd C:\Users\MaxVolkov\dev\cognify
npm run dev
```

The dev server listens on **http://localhost:3333** (port configured in `package.json`'s `dev` script and `.env.example`). Bound to `0.0.0.0` so you can also hit it from another device on the same wifi via your LAN IP.

Stop the server: `Ctrl+C` in the terminal where it's running.

## When to restart the dev server

Next.js has excellent hot-module-reload (HMR) for most code changes — edit a component, save, the browser updates automatically. **You do not need to restart for ordinary edits.**

But **you MUST restart** in these situations:

### 1. After editing any file in the route group root

- `src/middleware.ts` — middleware only loads on server boot
- `src/auth.ts` — Auth.js config is cached across hot reloads
- `next.config.ts` — obvious
- `tailwind.config.*`, `postcss.config.*`, `tsconfig.json`
- `drizzle.config.ts`
- `.env.local` — env vars are read at boot

### 2. After adding, moving, or renaming files in `src/app/`

New routes don't always pick up through HMR. Moving a file from `(admin)/teams` to `admin/teams` is the classic case — the old compiled module IDs stick around in `.next/` and you'll see:

```
TypeError: __webpack_modules__[moduleId] is not a function
```

Whenever you see that error, it's a **stale webpack cache**. Fix below.

### 3. After installing new npm packages

```bash
npm install some-package
# Then restart the dev server
```

### 4. After fixing a module-not-found error

Sometimes Next's dev server caches a failed import resolution even after you add the missing file. A restart clears it.

### 5. After a crash in the dev server itself

If you see `⨯ Failed to start server` or the dev server exits unexpectedly, restart it. If the port is stuck (see below), kill the process first.

## The "full clean restart" recipe

When HMR gets confused or you see webpack cache errors, run this three-step recipe:

```bash
# 1. Stop the current dev server (Ctrl+C, or find & kill the PID — see below)

# 2. Delete the Next.js build cache
rm -rf .next

# 3. Start fresh
npm run dev
```

**This clears 95% of "weird dev server behavior" issues.** Make it a reflex.

## Port already in use — hunting and killing by PID

Windows doesn't always cascade signals through `npm run`, so sometimes the underlying Node process survives your `Ctrl+C` or terminal close. You'll see:

```
⨯ Failed to start server
Error: listen EADDRINUSE: address already in use 0.0.0.0:3333
```

**Git Bash:**
```bash
# Find the PID holding the port
netstat -ano | grep ":3333.*LISTENING"
#   TCP    0.0.0.0:3333    0.0.0.0:0    LISTENING    <PID>

# Kill it (use double-slash for Git Bash)
taskkill //F //PID <PID>
```

**PowerShell:**
```powershell
# Find and kill in one pipeline
Get-NetTCPConnection -LocalPort 3333 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

**Command Prompt:**
```cmd
netstat -ano | findstr :3333
taskkill /F /PID <PID>
```

Then verify the port is free before restarting:
```bash
netstat -ano | grep ":3333.*LISTENING" || echo "port 3333 free"
```

## Changing the port

Edit `package.json`:
```json
"dev": "next dev -p 4000 -H 0.0.0.0"
```

Then also update `.env.local` (or `.env.example` as a template):
```
AUTH_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:4000
```

Restart the dev server after the change.

## Environment variables

All optional — Cognify gracefully degrades when each is missing. To unlock full functionality, add to `.env.local`:

```bash
# Core model (unlocks framework generation + scoring)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Speech-to-text (unlocks real transcripts with word timestamps)
DEEPGRAM_API_KEY=...

# Audio storage (unlocks persistent audio playback across sessions)
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Database (unlocks progress, leaderboard, compare, validation)
DATABASE_URL=postgres://user:pw@host/dbname?sslmode=require

# Auth (only if you want Google sign-in to work)
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=http://localhost:3333
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

Env changes require a dev-server restart.

## Common error messages and fixes

### `__webpack_modules__[moduleId] is not a function`
Stale webpack cache after file moves. Fix: `rm -rf .next && npm run dev`.

### `Failed to start server: EADDRINUSE`
Zombie process on the port. Fix: `netstat -ano | grep :3333` → `taskkill //F //PID <PID>` → `npm run dev`.

### `Module not found: Can't resolve '@/...'`
You imported something that doesn't exist. Check the path (remember `@/` maps to `src/`), create the file, then restart if HMR doesn't pick it up.

### `Database connection string format for neon()...`
`DATABASE_URL` is missing or malformed. Either set it correctly in `.env.local` or leave it unset — Cognify falls back gracefully to in-memory mode. Never set it to a placeholder.

### `MissingSecret: Please define a secret`
`AUTH_SECRET` is missing. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and put it in `.env.local`. Cognify has a dev fallback so this is a warning, not a blocker.

### `missing required error components`
Old Cognify issue — fixed now with `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`, and `loading.tsx`. If it comes back, it means one of those files was deleted. Put it back.

## Build and production check

Before shipping:

```bash
npm run typecheck   # strict TS, must pass
npm run lint        # ESLint, must pass
npm run build       # production build, must compile
npm run start       # serves the production build locally on port 3333
```

Only run `npm run start` after a successful `npm run build` — it serves the `.next/` output, not source.

## Background dev server (don't)

Avoid running `npm run dev` in the background with `&` or nohup on Windows. The process-tree handoff is unreliable and you'll end up with orphaned processes on the port. Keep the dev server in a visible terminal, or use a dedicated VS Code terminal tab you can reach with `Ctrl+\``.

## Quick reference

| Situation | Command |
| --- | --- |
| Normal start | `npm run dev` |
| Clean restart | `rm -rf .next && npm run dev` |
| Port stuck | `netstat -ano \| grep :3333` → `taskkill //F //PID <PID>` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Production build | `npm run build` |
| Run production build | `npm run start` |
| Push DB schema | `npm run db:push` (requires `DATABASE_URL`) |
| DB studio | `npm run db:studio` |
