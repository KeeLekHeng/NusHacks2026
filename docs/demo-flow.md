# Demo Flow

1. Start backend and frontend locally.
2. Open frontend, enter a goal and optional URL.
3. Click **Run Agent**.
4. Show:
   - generated plan
   - concise summary
   - raw normalized `data`
   - `sources`
5. Optional demo toggle:
   - with no API keys (mock mode still works)
   - with API keys (live OpenAI + TinyFish behavior)

## Demo Tips
- Keep one or two reliable URLs ready.
- If TinyFish endpoint behavior changes, update only `backend/app/services/tinyfish_client.py`.
