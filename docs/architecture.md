# Architecture (Hackathon MVP)

## High-level flow
1. User enters `goal` and optional `url` in Next.js frontend.
2. Frontend sends `POST /agent/run` to FastAPI backend.
3. Backend creates a short plan (OpenAI wrapper, mockable).
4. Backend runs TinyFish extraction for `goal + url` (live or mock fallback).
5. Backend summarizes output (OpenAI wrapper, mockable) and returns normalized JSON.

## Design choices
- Minimal service wrappers (`openai_client.py`, `tinyfish_client.py`) for fast iteration.
- No auth, database, queues, or background workers.
- Simple contract-first API so frontend and backend can evolve quickly in parallel.
