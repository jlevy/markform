---
close_reason: null
closed_at: 2025-12-24T18:07:50.700Z
created_at: 2025-12-24T17:37:09.507Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.361Z
    original_id: markform-180
id: is-01kg3x1bv285hqnx8mmq5y8fbj
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: LiveAgent systemPromptAddition support
type: is
updated_at: 2025-12-24T18:07:50.700Z
version: 1
---
## Summary
Add `systemPromptAddition` config option to LiveAgent for appending context to composed prompt.

## Files
- MODIFY: `src/harness/liveAgent.ts`

## Deliverables
1. Add `systemPromptAddition?: string` to `LiveAgentConfig`
2. Append to composed prompt in `generatePatches()` method
3. Ensure form's built-in instructions are preserved

## Behavior
- If `systemPromptAddition` provided: append after composed prompt
- If null/undefined: no change to prompt
- Never override form instructions

## Tests
- tests/unit/liveAgent.test.ts
  - systemPromptAddition is appended to composed prompt
  - Null/undefined doesn't affect prompt

## Spec Reference
docs/project/specs/active/plan-2025-12-24-programmatic-fill-api.md
