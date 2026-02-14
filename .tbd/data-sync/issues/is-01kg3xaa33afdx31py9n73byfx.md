---
close_reason: "Added maxRetries to LiveAgentConfig (default: 3), passed through to AI SDK generateText(). SDK handles 429/503 with exponential backoff. Set to 0 to disable for tests."
closed_at: 2026-02-14T19:56:35.631Z
created_at: 2025-12-23T22:14:42.356Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.119Z
    original_id: markform-120
id: is-01kg3xaa33afdx31py9n73byfx
kind: task
labels: []
parent_id: null
priority: 4
status: closed
title: "FILL-002: Specify retry/backoff policy for live agent"
type: is
updated_at: 2026-02-14T21:00:55.562Z
version: 3
---
Define and document the retry/backoff strategy for live agent API calls.

**Spec to add:**
- Retry on 429 (rate limit) and 503 (service unavailable)
- Exponential backoff with jitter
- Max 3 retries, max 30s total wait
- Toggle to disable retries for fast tests

**Implementation:**
- Add retry wrapper in liveAgent.ts
- Unit tests for retry behavior
- Document in fill command plan

**Files:**
- docs/project/specs/active/plan-2025-12-23-fill-command-live-agent.md
- packages/markform/src/harness/liveAgent.ts
