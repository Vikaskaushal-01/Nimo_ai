# Multi-AI Decision Engine

> **Multiple AI Models. One Intelligent Decision.**

Query multiple LLMs in parallel, score and rank every response across quality
metrics, then **fuse** the strongest parts of each into a single optimized answer
— with per-section contribution attribution, confidence scores, and full
analytics (latency, tokens, cost).

This repository contains **Iteration 1: the core engine vertical slice** — the
actual differentiator running end-to-end on a clean, feature-based architecture
that the remaining SaaS features layer onto without redesign.

---

## What works today

```
prompt + selected models
        │
        ▼  parallel fan-out via OpenRouter  (orchestration)
   N raw responses  ──►  normalize (latency, tokens, cost)
        │
        ▼  embeddings + per-response metrics  (evaluation)
   semantic similarity · completeness · accuracy ·
   reasoning · readability · context · hallucination risk
        │
        ▼  weighted score → confidence % summing to 100   (ranking)
        │
        ▼  LLM synthesis → optimized answer + contribution map  (fusion)
        │
        ▼  persist to Mongo · cache in Redis
        │
        ▼  fused answer + comparison cards + leaderboard  (UI)
```

| Layer | Location |
| --- | --- |
| Provider abstraction (`IProvider`) | `backend/src/modules/ai` |
| Model catalog (single source of truth) | `backend/src/config/providers.ts` |
| Orchestration (parallel, timeout, failover) | `backend/src/modules/orchestration` |
| Evaluation metrics (pure, unit-tested) | `backend/src/modules/evaluation` |
| Ranking + 100% confidence | `backend/src/modules/ranking` |
| Response fusion | `backend/src/modules/fusion` |
| Decision pipeline + REST | `backend/src/modules/decision` |
| Chat persistence | `backend/src/modules/chat` |
| Analytics aggregation | `backend/src/modules/analytics` |
| Chat + comparison UI | `frontend/src/features` |

---

## Quick start

### Option A — Docker Compose (recommended, matches prod)

```bash
cp .env.example .env
# (optional) set OPENROUTER_API_KEY in .env — without it, a deterministic
# MockProvider serves canned responses so everything still runs.
docker compose up --build
```

- Frontend: http://localhost:5173
- API:      http://localhost:4000/api/v1
- Health:   http://localhost:4000/api/v1/health

### Option B — Run services locally

You need MongoDB and Redis reachable (e.g. `docker compose up mongo redis`).

```bash
# backend
cd backend && npm install && npm run dev      # http://localhost:4000

# frontend (separate terminal)
cd frontend && npm install && npm run dev      # http://localhost:5173
```

---

## No API key? Still works.

If `OPENROUTER_API_KEY` is empty, the backend uses a **MockProvider** that
returns deterministic, varied responses. The entire pipeline — orchestration,
evaluation, ranking, fusion, persistence — runs so you can demo and test the UI
with zero external dependencies.

---

## Tests

```bash
cd backend && npm test
```

Deterministic unit tests cover every evaluation metric and the
largest-remainder normalization that guarantees confidence percentages sum to
exactly 100. No network calls.

---

## Adding a model

Edit **`backend/src/config/providers.ts`** only — add an entry to `MODEL_CATALOG`.
No business-logic changes required; the orchestrator, evaluator, and UI pick it
up automatically. Adding a *new provider* (native OpenAI/Anthropic/etc.) means
implementing `IProvider` and registering it in `provider.registry.ts`.

---

## Authentication

Email + password auth with JWT access tokens (15 min) and rotating refresh
tokens (7 days, stored hashed). All engine and chat routes require a valid
access token; the frontend attaches it automatically and transparently refreshes
on 401. The **first account created becomes an admin** (RBAC is enforced via
`requireRole`). Conversations and messages are scoped to their owner.

```
POST /api/v1/auth/register   { email, password, name }   → { user, accessToken, refreshToken }
POST /api/v1/auth/login      { email, password }          → { user, accessToken, refreshToken }
POST /api/v1/auth/refresh    { refreshToken }             → rotated tokens
POST /api/v1/auth/logout     { refreshToken }             → revokes the token
GET  /api/v1/auth/me         (Bearer access token)        → current user
```

## Roadmap (next iterations)

- ✅ 1. Core engine vertical slice
- ✅ 2. Auth + users + RBAC
- ✅ 3. SSE streaming + real-time UI
- ✅ 4. RAG / knowledge base + file uploads
- ✅ 5. Analytics dashboards + charts
- 6. Workspaces / teams + admin
- 7. DevOps hardening (CI/CD, k8s, monitoring, full test suite)

---

## API

### `POST /api/v1/decision`
```jsonc
// request
{ "prompt": "Explain CAP theorem", "models": ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"], "conversationId": "optional" }

// response (abridged)
{
  "success": true,
  "data": {
    "conversationId": "…",
    "messageId": "…",
    "optimizedAnswer": "…markdown…",
    "reasoningSummary": "…",
    "contributionMap": [{ "section": "Introduction", "models": ["…"] }],
    "ranking": [{ "model": "…", "score": 94.2, "confidence": 34, "metrics": { … }, "latencyMs": 1200, "tokens": 512, "costUsd": 0.0003, "hallucinationRisk": 0.08 }],
    "meta": { "totalLatencyMs": 1800, "fromCache": false, "failedModels": [] }
  }
}
```

### `POST /api/v1/decision/stream` (Server-Sent Events)
Same body as `/decision`, but streams the pipeline live. Use `fetch` (not
`EventSource`) so the request carries the Bearer token + JSON body. Emits
`data:`-framed JSON events:

```
start       → { models: [{ id, label, vendor }] }
token       → { model, delta }              # live token chunks per model
model_done  → { model, latencyMs, tokens, costUsd }
model_error → { model, label, error }
stage       → { stage: querying|evaluating|ranking|fusing|saving }
ranked      → { ranking: [...] }            # scores/confidence before fusion finishes
done        → { result: <DecisionResult> }
error       → { message }
```

### Knowledge Base (RAG)
Upload documents, which are parsed → chunked → embedded → stored. When enabled
on a decision, the most relevant chunks are retrieved (cosine similarity) and
injected as grounding context; retrieved **sources** are returned in the result
and rendered in the UI. Supported: txt, md, csv, json, code, **pdf**, **docx**.

```
POST   /api/v1/knowledge/documents   (multipart: file)   → ingest + index
GET    /api/v1/knowledge/documents                        → list user's docs
DELETE /api/v1/knowledge/documents/:id                    → delete doc + chunks
POST   /api/v1/knowledge/search      { query, documentIds?, topK? }  → ranked chunks
```
The decision endpoints accept `useKnowledgeBase: boolean` and/or
`documentIds: string[]` to turn on retrieval (the latter scopes it to specific
documents).

### Analytics

A per-user dashboard (`/analytics` in the UI) aggregates every persisted
decision into usage and quality trends: total decisions/spend/tokens, average
latency, a daily activity + spend timeseries, a model leaderboard, the mean
evaluation profile (radar), vendor share, and a per-model table (win rate,
average score, latency, tokens, spend, hallucination risk). Aggregation runs
in-process over the user's own messages, scoped through conversation ownership.

```
GET /api/v1/analytics/overview?days=30   → { range, totals, metricAverages, models[], vendors[], timeseries[] }
```
`days` is clamped to 1–365 (default 30).

Other endpoints: `GET /api/v1/models`, `GET /api/v1/health`,
`GET/POST/DELETE /api/v1/conversations`, `GET /api/v1/conversations/:id/messages`.
