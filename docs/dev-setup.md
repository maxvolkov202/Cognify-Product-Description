# Cognify — Developer Setup Guide

This guide gets a new developer running Cognify locally in ~10 minutes.

---

# 1. Prerequisites

Install the following on your MacBook.

### Homebrew (package manager)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Verify:

```bash
brew -v
```

---

### Node.js (LTS)

Cognify runs on Node 20+.

```bash
brew install node
```

Verify:

```bash
node -v
npm -v
```

---

### Git

Check if installed:

```bash
git --version
```

If missing:

```bash
brew install git
```

---

### Docker Desktop

Required for running Supabase locally.

Install:

https://www.docker.com/products/docker-desktop/

Verify:

```bash
docker --version
```

---

### Supabase CLI

Used for running edge functions and database migrations.

```bash
brew install supabase/tap/supabase
```

Verify:

```bash
supabase --version
```

---

### Cursor

Download and install:

https://cursor.sh

Cursor is the primary IDE used in this project.

---

# 2. Clone the Repository

```bash
git clone <REPO_URL>
cd cognify
```

---

# 3. Install Dependencies

```bash
npm install
```

---

# 4. Environment Variables

Create a local environment file:

```
.env.local
```

Add:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Ask the team for these values.

If working on edge functions you will also need:

```
OPENAI_API_KEY=
```

---

# 5. Run the App

Start the development server:

```bash
npm run dev
```

The app will run at:

```
http://localhost:5173
```

---

# 6. Supabase (Optional Local Dev)

If you need to run Supabase locally:

```bash
supabase start
```

This launches:

* local Postgres
* local Supabase API
* local edge functions

---

# 7. Project Stack

Frontend

* React
* TypeScript
* Vite
* Tailwind

State

* React Context (reps flow)
* Zustand may be introduced later

Backend

* Supabase (Postgres + Auth + Storage)
* Supabase Edge Functions

AI

* OpenAI Whisper (transcription)
* GPT models for coaching + scoring

---

# 8. Core Product Loop

Cognify is a communication training gym.

Flow:

1. Select scenario
2. Record ≤90s audio
3. Upload to Supabase Storage
4. Edge function processes the rep
5. AI returns feedback and next focus
6. User trains again

Key tables:

```
reps
delivery_scores
```

---

# 9. Important Folders

```
src/app/pages
src/app/v2/components
supabase/functions
```

Examples:

```
ResultsScreen.tsx   → post-recording results
RecordingArea.tsx   → audio recording
RepDetailPage.tsx   → feedback view
score-rep           → edge function that scores reps
```

---

# 10. Useful Commands

Install dependencies

```bash
npm install
```

Run dev server

```bash
npm run dev
```

Run Supabase locally

```bash
supabase start
```

Deploy edge functions

```bash
supabase functions deploy
```

---

# 11. Troubleshooting

### Node version issues

Ensure Node 20+.

```
node -v
```

---

### Supabase CLI issues

Restart Docker and try:

```
supabase start
```

---

### Audio not playing locally

Audio files are stored in a **private Supabase bucket**, so playback uses **signed URLs**.

---

# 12. Getting Help

If you get stuck:

1. Check the README
2. Ask in the team Slack
3. Run code search in Cursor
4. Check Supabase logs

---

Welcome to Cognify 🚀
