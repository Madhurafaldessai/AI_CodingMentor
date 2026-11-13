# ByteBloom

ByteBloom is a coding learning app with an adaptive challenge workspace and a progressive AI mentor named Bloom.

## Project layout

```text
ByteBloom/
├── frontend/              # Next.js UI, routes, styles, Monaco, browser runners
│   ├── app/
│   │   └── api/            # Thin Next route adapters that delegate to backend/
│   ├── lib/runners/        # Browser worker runners
│   └── next.config.mjs
├── backend/               # API handlers, challenge data, adaptive logic, DB/LLM services
│   ├── app/api/
│   ├── lib/
│   ├── supabase/schema.sql
│   └── tests/
├── README.md
└── package.json            # Shared scripts and dependencies
```

The route adapters live in `frontend/app/api/` because Next.js exposes HTTP routes there. Their implementation and business logic are in `backend/app/api/` and `backend/lib/`.

## Run locally

From the repository root:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Build with `npm run build`. Run adaptive and XP checks with `npm run test:unit`.

## Main pages

- `/` landing page
- `/signup`, `/login`, `/onboarding/username`
- `/dashboard`, `/course/python`, `/course/javascript`, `/course/cpp`
- `/practice`, `/interview`, `/workspace/reverse-string`
- `/insights`, `/settings`

## Demo behavior and services

The app runs without credentials. Sign in and progress use a demo flow; the in-memory backend resets when the dev server restarts. Python executes in a Pyodide Web Worker and JavaScript executes in a Web Worker with a five second code timeout. Pyodide is loaded from a CDN when the Python runner is used. C++ uses Judge0 when configured and a deterministic mock fallback otherwise.

Bloom applies local rules first, then uses Groq when a key is configured, and returns deterministic hints when it is not. Supabase schema is provided, but the current demo data adapter is in memory and does not persist to Supabase yet. Mock sign-in does not validate credentials or provide real Google OAuth.

## Environment variables

Copy `backend/.env.example` to `frontend/.env.local`. Keep server credentials out of browser code.

- `GROQ_API_KEY` and `MENTOR_MODEL` configure Bloom's Groq provider.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are for future Supabase Auth integration.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- `JUDGE0_URL` and `JUDGE0_API_KEY` configure the C++ runner.

Apply `backend/supabase/schema.sql` in the Supabase SQL editor when wiring up persistent storage. Reference solutions have a separate restricted table in the schema and are returned by the mentor only for hint level 4.

## Adaptive engine

`backend/lib/adaptive.ts` contains pure functions for concept mastery, pacing, next challenge choice, preferred explanation style, and learner summaries. Mastery uses a 70/30 exponential moving average: first try without hints targets 100; a hinted pass targets 85 minus 8 per hint level (floor 40); a multi-attempt pass targets 75; a failure targets 30. Pace uses the last five attempts. `backend/lib/xp.ts` calculates hint deductions, levels, and garden stages.

## Ownership map

- Frontend work belongs in `frontend/app/**` and `frontend/lib/**`.
- Backend behavior belongs in `backend/app/api/**`, `backend/lib/**`, and `backend/supabase/**`.
- Keep this README at the repository root.
