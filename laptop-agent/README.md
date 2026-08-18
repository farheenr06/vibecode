# Agent Deck — Real-Time Autonomous Web Agent

A research agent you can actually *watch work*. No fake loading bars, no
scripted delays — every line in the UI is triggered by a real backend event:
a real Tavily search call, a real page fetch, a real Gemini call, written to
Supabase and streamed to the browser over SSE the instant it happens.

```
React (SSE client) ⇄ Express (SSE stream) ⇄ Orchestrator ⇄ Gemini / Tavily / fetch
                                     ↓
                                Supabase (tasks, agent_events)
```

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `backend/supabase/schema.sql`. This creates
   `tasks` and `agent_events` (the full event log, so progress survives a
   refresh or a dropped connection).
3. Copy your **Project URL** and **service_role key** from
   *Project Settings → API* — you'll need them below.

## 2. Backend

```bash
cd backend
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
                        # GEMINI_API_KEY, TAVILY_API_KEY
npm install
npm run dev             # http://localhost:8787
```

- **Gemini key**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **Tavily key** (search API built for agents): [tavily.com](https://tavily.com) — free tier available

## 3. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_BASE=http://localhost:8787
npm install
npm run dev             # http://localhost:5173
```

Open the app, type a request, hit **Start Agent**, and watch the trace,
sources, comparison table, and verification panel populate live as the
backend actually does the work.

## How the real-time pipeline works

1. `POST /api/tasks` creates a row in `tasks` and immediately returns a
   `task_id` — the orchestrator (`backend/src/agent/orchestrator.js`) keeps
   running server-side, it isn't tied to the HTTP request.
2. `GET /api/tasks/:id/stream` is a Server-Sent Events endpoint. Each agent
   step (`agent_started`, `search_started`, `page_opened`, `data_extracted`,
   `conflict_detected`, `recommendation_generated`, …) is written to
   `agent_events` in Supabase **and** pushed to any open SSE connection the
   moment it's produced — never batched, never delayed for effect.
3. **Reconnection**: the client passes `?since_event_id=<last seen>`. The
   server first replays anything already persisted in Supabase after that
   id, then subscribes the connection to live events. The agent task itself
   is a detached async function — it never restarts because a browser tab
   reconnected.
4. **Parallel research**: once search results come back, the orchestrator
   opens every candidate source concurrently (`Promise.all`), each acting as
   an independent "Research Agent A/B/C…" that emits its own `page_opened` /
   `data_extracted` events in whatever order the real network responses
   arrive in.
5. **Verification**: for each product, prices from every source that
   mentioned it are cross-checked. A >5% spread emits `conflict_detected`,
   triggers one extra real search + fetch as a tie-breaker, then
   `verification_completed` with a computed confidence score.
6. **Decision**: Gemini scores every candidate and picks a winner
   (`rankAndRecommend` in `backend/src/agent/tools/llm.js`), which the
   frontend reveals as the final recommendation card.

## Swapping in Playwright

`backend/src/agent/tools/extract.js` currently fetches pages with plain
`fetch` + Cheerio, which is enough for most listing/spec pages and keeps
setup light (no browser binaries). For JS-heavy sites, replace
`fetchPageText` with a Playwright-backed version
(`page.goto(url); await page.content()`) — the rest of the pipeline
(events, Supabase writes, extraction prompt) doesn't need to change.

## Notes

- The `service_role` Supabase key is server-side only — it's read from
  `backend/.env` and never sent to the browser.
- `agent_events` is append-only and is the single source of truth for
  progress; the in-memory `eventBus.js` is purely a fan-out for connections
  that happen to be open right now.
