# UCrave Agent

**An AI planning agent for Manila University-Belt students.** Give it a budget, a time window, a location, and a craving — it returns a concrete meal plan: which spot(s), in what order, that fit the money and the time, each with a one-line reason.

Not a discovery app that lists places. An agent that *decides* — the way a food-savvy classmate would.

Built for **OpenAI Build Week** with **Codex** (core logic) and **GPT-5.6** (runtime reasoning).

---

## The problem

We're University-Belt students. The daily reality: a small budget, a short gap between classes, and no good way to decide where to eat. Existing apps *list* restaurants — they don't *plan* a meal run for ₱150 and 40 minutes, and they don't know the ₱35 silog spot in the alley that isn't on any map.

So we collected the ground truth ourselves. UCrave puts that local knowledge into an agent.

## What it does

A student enters four things:
- **Budget** (₱)
- **Time available** (minutes)
- **Location / cluster** (which part of U-Belt they're in)
- **Craving** (what they're in the mood for)

The agent reasons over our surveyed spot data — filtering by location, budget, and open hours — and GPT-5.6 composes a concrete plan honoring the time window and the craving, with a short justification for each pick.

**Example**

> *Input:* ₱350, 90 minutes, U-Belt / Sampaloc, "merienda then coffee to study"
> *Output:* An ordered route — 01 a ₱ merienda stop, 02 a coffee spot to study at — each with a one-line reason tying it to the budget, the clock, and the craving.

## How it works

1. **Input** — a single form (four fields, no accounts).
2. **Pre-filter in code, not in the model** — the server filters `ucrave-spots.json` down to candidates that fit the zone (derived from coordinates where not tagged), the budget tier, and open-now hours, then passes **at most 24 candidates** to the model.
3. **GPT-5.6 composes the plan** — via strict JSON-schema structured output: an ordered route of 1–3 stops, each with a one-line reason. Every returned spot is validated against the supplied candidates, so the model cannot hallucinate a place that doesn't exist.
4. **Output** — a clean result card: the titled plan, numbered stops, each spot with its "why," and a friendly no-match fallback instead of an error.

## Tech

- **Codex** — authored the core planner during the event.
- **GPT-5.6** (`gpt-5.6-terra`) — runtime reasoning that composes each meal plan.
- **Web app** — React (Vite) frontend, Node/Express backend for local dev, Vercel serverless function (`api/plan.js`) in production. Both share the same planner module (`lib/planner.js`).
- **Data** — `ucrave-spots.json`: 204 real food spots, 66 fully enriched (price range, hours, vibe tags).

## The data

The spot dataset was **collected by our team through field research** using **Munch Scout**, our own survey tool — we logged real food spots around the University Belt on foot, recording public business information (name, coordinates, price range, hours, and our own vibe tags). Of 204 spots, 66 are fully enriched. This dataset is raw material we brought to the build as input; the application code was built during the event window, with **Codex authoring the core planner**.

`ucrave-spots.json` contains only public business information. No personal or private contact data is included.

## Running it locally

```bash
# 1. Clone
git clone https://github.com/tristanalonzo/OpenAI-Buildathon.git
cd OpenAI-Buildathon

# 2. Install (root + client)
npm install
npm install --prefix client

# 3. Configure — create .env at the repo root (UTF-8, single line):
# OPENAI_API_KEY=sk-...

# 4. Run (starts Vite client + Express API together)
npm run dev
# open the URL Vite prints (usually http://localhost:5173)
```

The dataset is included in `ucrave-spots.json`, so the app runs out of the box — the server logs `Loaded 204 spots across 4 zones` and `KEY LOADED: true` on a healthy start.

## Deploying (Vercel)

- `vercel.json` sets the install/build commands and `client/dist` as the output directory.
- `api/plan.js` is the serverless port of the planner (same shared `lib/planner.js`).
- Set `OPENAI_API_KEY` in Vercel → Project → Settings → Environment Variables (all environments), then push to `main` to deploy.

## How we built it with Codex

- **Scaffolding:** Vite + React client, Express server, concurrent dev script, dataset loader with startup verification (`204 spots / 4 zones`).
- **Filter-in-code architecture:** candidate narrowing (zone, budget tier, open-now) happens in deterministic code before the model call — the model only ever sees ≤ 24 candidates, keeping calls cheap and grounded.
- **Schema-validated output:** strict JSON-schema structured output plus a server-side check that every chosen spot exists in the candidate list — no hallucinated restaurants.
- **The model-ID debugging arc:** a `400 model does not exist` was resolved by querying `GET /v1/models` on our account and using the exact listed 5.6-family ID.
- **Where GPT-5.6 does the reasoning:** composing the ordered multi-stop route and writing the per-stop justification, at runtime, on every request.

Codex session ID for the thread where the majority of core functionality was built: `[paste /feedback session ID]`

## Team

Two third-year Computer Science students, and University-Belt locals who had this problem first.

## Category

Apps for Your Life / Education

---

*Built during OpenAI Build Week Manila, July 2026.*
