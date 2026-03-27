# AI Hackathon Starter (Next.js + FastAPI)

Minimal full-stack starter optimized for a 1-day AI hackathon MVP:
- `frontend`: Next.js + TypeScript + Tailwind
- `backend`: FastAPI with simple agent flow
- External adapters: OpenAI + TinyFish (with mock-safe fallbacks)

## Why this starter

- Fast end-to-end demo path
- Clean and readable architecture
- Contract-first API for quick iteration
- Minimal abstractions so coding agents can extend it quickly

## Project Structure

```text
.
├─ frontend/
├─ backend/
├─ .codexagent/
├─ docs/
├─ .env.example
└─ README.md
```

## Stack

- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
- Backend: FastAPI, Pydantic, HTTPX
- AI/Agent services: OpenAI + TinyFish

## Local Setup

1) Copy env template:
```bash
cp .env.example .env
```

2) Backend setup:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

3) Frontend setup:
```bash
cd frontend
npm install
npm run dev
```

4) Open app:
- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8000/docs`

## Environment Variables

From `.env.example`:
- `NEXT_PUBLIC_API_BASE_URL` (frontend -> backend URL)
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `TINYFISH_API_KEY`
- `TINYFISH_BASE_URL`
- `CORS_ORIGINS`

## API Endpoints

- `GET /health`
- `POST /agent/run`

Request:
```json
{
  "goal": "Find the latest prices for X",
  "url": "https://example.com"
}
```

Response:
```json
{
  "status": "completed",
  "plan": ["step 1", "step 2"],
  "summary": "short summary",
  "data": {},
  "sources": ["https://example.com"]
}
```

## Hackathon Positioning

- Demo-first over production complexity
- No auth/database/queue by default
- Easy to replace mock wrappers with live calls

## TinyFish Note

TinyFish API is integrated using the official auth header (`X-API-Key`) and `automation` endpoints shape observed in TinyFish docs. Final endpoint behavior should still be quickly verified before demo day, since SaaS APIs can evolve.