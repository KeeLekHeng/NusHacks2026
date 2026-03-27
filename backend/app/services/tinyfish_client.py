from typing import Any

import httpx


def run_tinyfish(goal: str, url: str | None, api_key: str | None, base_url: str) -> dict[str, Any]:
    if not url:
        return {
            "provider": "tinyfish",
            "mode": "skipped",
            "result": {},
            "note": "No URL provided. TinyFish step skipped.",
        }

    if not api_key:
        return {
            "provider": "tinyfish",
            "mode": "mock",
            "result": {
                "message": f"Mock extraction for goal '{goal}' on {url}",
                "items": [],
            },
            "note": "Set TINYFISH_API_KEY to run live extraction.",
        }

    # Official TinyFish docs: REST endpoint supports POST /v1/automation/run.
    # SSE streaming is available at /v1/automation/run-sse, but this starter keeps
    # a simple request/response integration for speed.
    endpoint = f"{base_url.rstrip('/')}/v1/automation/run"
    payload = {"goal": goal, "url": url}
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

    with httpx.Client(timeout=60) as client:
        response = client.post(endpoint, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
