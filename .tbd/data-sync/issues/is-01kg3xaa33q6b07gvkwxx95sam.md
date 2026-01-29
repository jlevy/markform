---
close_reason: null
closed_at: 2025-12-24T01:55:47.599Z
created_at: 2025-12-23T22:14:49.304Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.124Z
    original_id: markform-121
id: is-01kg3xaa33q6b07gvkwxx95sam
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "FILL-003: Improve provider installation error messages"
type: is
updated_at: 2025-12-24T01:55:47.599Z
version: 1
---
Improve error messages when AI SDK provider package is not installed.

**Error should include:**
- Provider name
- Install command suggestion (e.g., `pnpm add @ai-sdk/anthropic`)
- Current `--model` argument value

**Also verify:**
- Env var names match AI SDK expectations (`GOOGLE_GENERATIVE_AI_API_KEY` vs `GOOGLE_API_KEY`)

**Files:**
- packages/markform/src/harness/liveAgent.ts
- packages/markform/src/harness/modelResolver.ts
