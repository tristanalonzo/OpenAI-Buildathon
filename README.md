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

> *Input:* ₱150, 45 minutes, Morayta cluster, "something warm"
> *Output:* A plan with 1–2 spots, in order, each with a one-line reason (price, walk time, why it fits the craving).

## How it works

1. **Input** — a single form (four fields, no accounts).
2. **Agent loop** — filters `spots.json` to candidates that fit location, budget, and open hours, then GPT-5.6 composes and justifies the plan.
3. **Output** — a clean result card: the plan, each spot with its "why."

## Tech

- **Codex** — authored the application code.
- **GPT-5.6** — runtime reasoning that composes each meal plan.
- **Web app** — [fill in stack: e.g. React frontend, Node/Express backend].
- **Data** — `spots.json`, a dataset of real U-Belt food spots.

## The data

The spot dataset was **collected by our team through field research** — we surveyed real food spots around the University Belt on foot, logging public business information (name, cluster, price range, hours, and our own category tags). This dataset is raw material we brought to the build; **all application code was written with Codex during the event.**

`spots.json` contains only public business information. No personal or private contact data is included.

## Running it locally

> [Fill in during Sprint 2 — keep it to steps a stranger can follow in 5 minutes.]

```bash
# 1. Clone
git clone [repo-url]
cd ucrave-agent

# 2. Install
[npm install]

# 3. Configure
# Set your OpenAI API key:
export OPENAI_API_KEY=...

# 4. Run
[npm run dev]
# open http://localhost:[port]
```

Sample data is included in `spots.json` so the app runs out of the box.

## How we built it with Codex

> [Fill from NOTES.md before submitting. Be specific — name real decisions, not "Codex helped us code faster."]

- **Scaffolding:** [what Codex set up]
- **Agent loop:** [key decision Codex made — e.g. "precompute per-cluster candidate filtering before the model call rather than passing the full dataset each time"]
- **[Decision 2]:** [...]
- **Where GPT-5.6 does the reasoning:** [the specific step — composing and justifying the plan]

Codex session ID for the thread where the majority of core functionality was built: `[paste /feedback session ID]`

## Team

Two third-year Computer Science students, and University-Belt locals who had this problem first.

## Category

Apps for Your Life / Education

---

*Built during OpenAI Build Week Manila, July 2026.*
