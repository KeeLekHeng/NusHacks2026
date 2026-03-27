# Coding Rules

- Do not refactor unrelated files.
- Keep changes minimal and localized.
- Do not introduce new dependencies unless justified.
- Prefer simple implementations over abstract frameworks.
- Preserve existing API contracts unless explicitly told to change them.
- Add comments only where they are helpful for future edits.
- Prioritize clean, readable code over cleverness.
- If uncertain, choose the fastest reliable implementation.

## Hackathon defaults

- Principle of least surprise: avoid hidden side effects; make behavior predictable.
- Fail fast and loud: validate inputs early; surface errors with clear messages.
- Defensive coding: validate external data (HTTP responses, env vars, user input) at boundaries.
- Single source of truth: keep API contracts/types centralized; don’t duplicate unless necessary.
- DRY (lightweight): extract shared logic when repetition is meaningful (avoid premature abstraction).
- Prefer immutability by default (especially in TS/React state). Use mutation only when it is clearly simpler or measurably needed.
- Tech debt is allowed only when it buys speed: isolate it and tag it with `TechDebt:` plus context.

## Demo-first rule

- Optimize for a compelling live demo under time pressure.
- Prefer visible product value over invisible engineering polish.
- If forced to choose, prioritize:
  1. demo reliability
  2. clear user-facing value
  3. technical impressiveness
  4. internal polish

## Real web constraint

- Prefer real website flows and live data over mocks whenever feasible.
- Mock only when a third-party dependency is blocking the demo.
- If mocking is used, isolate it clearly and tag with `TechDebt: demo mock`.
- Preserve at least one believable end-to-end live path for judging.

## Judge-facing UX

- The main user flow must be understandable within 30 seconds.
- Show progress clearly: input, running state, result, sources, and failure state.
- Prefer fewer steps and fewer controls.
- Avoid exposing internal complexity unless it increases the wow factor.

## Trust & traceability

- Agent outputs should include enough evidence to be trusted.
- Whenever possible, return sources, extracted artifacts, or intermediate reasoning summaries.
- Do not present uncertain or partial results as definitive.
- Surface recoverable failures clearly and keep partial output when useful.

## Time-boxing

- Prefer the fastest reliable implementation that can be finished today.
- Avoid building generic systems, plugin architectures, or future-proof abstractions.
- If a feature cannot be made demo-ready quickly, cut scope instead of half-finishing it.

## Submission readiness

- Keep the repo runnable by judges with minimal setup.
- Update README only when it materially helps setup, demo, or architecture understanding.
- Track assumptions, env vars, and demo steps as they are introduced.
- Do not leave critical setup knowledge only in chat context.

## Agent architecture preference

- TinyFish is the browsing/extraction execution layer.
- OpenAI is the planning, reasoning, and summarization layer.
- Keep this separation clear in code and API responses.
- Avoid mixing provider-specific logic throughout the codebase; use small adapters.

## Anti-overengineering default

- Do not build infra-heavy systems unless the complexity itself is the product.
- Prefer one strong workflow over many half-working agent modes.
- New moving parts must justify themselves in demo value.

## Design & architecture (keep minimal, but clear)

- Single responsibility: each module/function should have one job.
- Keep layers separated:
  - Frontend: UI components call `lib/api.ts` (don’t sprinkle fetch logic everywhere).
  - Backend: route handlers are thin; business logic lives in `services/*`.
- Prefer composition over inheritance. Avoid deep class hierarchies.
- Prefer small adapters over “frameworks”: wrap OpenAI/TinyFish in tiny functions so swapping is easy.

## API & error handling

- Preserve API contracts by default; change only when explicitly requested.
- Every endpoint should return predictable shapes (success + error). No surprise fields.
- Validate request inputs at the boundary (FastAPI/Pydantic for backend, basic checks in frontend).
- When calling external services:
  - set timeouts
  - handle non-2xx responses
  - surface actionable errors (message should say what to fix: key missing, rate limit, etc.)

## Collaboration boundaries (hackathon)

- Default to single-domain changes:
  - frontend tasks modify `frontend/` only
  - backend tasks modify `backend/` only
- Cross-domain changes are allowed only when required to keep the end-to-end flow working (e.g. API contract alignment).
- If a cross-domain change is needed:
  - keep it minimal
  - explicitly list affected files in the task summary/PR
- Prefer contract-first updates in `.codexagent/api-contracts.md` before touching both domains.

## Naming

- Be precise: names should imply the datatype and intent (e.g. `userId` vs `id` in wide scopes).
- Functions are verbs (`fetchPrices`), data is nouns (`prices`).
- Avoid noise words and vague names like `data`, `result`, `value` unless scope is tiny.
- Booleans should read clearly (`isLoading`, `shouldRetry`, `hasAccess`).

## Folder & file structure

- Organize by feature/domain when it helps navigation; avoid dumping grounds like `utils/` unless scoped (e.g. `tinyfish_client.py` is fine).
- Keep folder depth shallow; prefer fewer files with clear names over excessive nesting.
- Avoid barrel/index files in backend services (makes navigation and imports harder).

## Comments & documentation

- Prefer self-documenting code; comment *why*, not *what*.
- If copying code or using AI-generated code for a tricky part, document the origin briefly.
- Document non-obvious config choices (timeouts, retries, model names) where it matters.

## Type safety (TS/Python)

- Prefer explicit input/output shapes for public boundaries (API handlers, service wrappers).
- Avoid `any`/casts; if unavoidable, isolate and tag with `TechDebt:` and a reason.
- Prefer `unknown` over `any` for untrusted inputs; validate before use.

## Async & resilience

- Always await promises / async calls; no silent fire-and-forget.
- Don’t rely on arbitrary sleeps/timeouts to “wait for things”; use proper completion signals.
- Prefer retry only where it’s safe (idempotent calls) and keep it simple.

## Testing (hackathon level)

- Add tests only where they buy confidence quickly (core parsing/normalization, critical logic).
- Keep tests simple (Arrange–Act–Assert). Avoid logic in tests.
