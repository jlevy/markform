---
close_reason: null
closed_at: null
created_at: 2025-12-23T22:14:42.356Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.001Z
    original_id: markform-120
id: is-01kg3x1bv0kxn5w0chzc47v91s
kind: task
labels: []
parent_id: null
priority: 4
status: open
title: "FILL-002: Specify retry/backoff policy for live agent"
type: is
updated_at: 2025-12-24T05:22:26.564Z
version: 1
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
