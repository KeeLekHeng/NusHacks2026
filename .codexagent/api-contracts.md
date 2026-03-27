# API Contracts

## `GET /health`

Response:
```json
{
  "status": "ok"
}
```

## `POST /agent/run`

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
  "sources": ["https://example.com"],
  "error": null
}
```

## Status Enum

- `completed`
- `completed_with_warnings`
- `failed`

## Error Response Shape

For recoverable flow errors, `POST /agent/run` returns:
```json
{
  "status": "completed_with_warnings",
  "plan": ["..."],
  "summary": "Plan completed, but extraction failed.",
  "data": {},
  "sources": [],
  "error": {
    "code": "AGENT_RUN_PARTIAL_FAILURE",
    "message": "Error details"
  }
}
```

For framework-level validation errors, FastAPI default `422` response applies.
