---
close_reason: null
closed_at: 2025-12-27T01:09:51.653Z
created_at: 2025-12-27T00:16:11.935Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.126Z
    original_id: markform-259
id: is-01kg3x1bv59g2kw2846zpmyq36
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Replace non-atomic file writes with atomically library
type: is
updated_at: 2025-12-27T01:09:51.653Z
version: 1
---
The project has a rule to use the `atomically` library for file writes (see docs/general/agent-rules/typescript-rules.md), but several files still use `writeFileSync` or `fs.promises.writeFile`.

## Implementation Approach

**CLI code in `src/`**: Use centralized `writeFile` helper in `shared.ts`
**Package scripts**: Import `atomically` directly (self-contained)
**Root scripts**: Import `atomically` directly (outside package)

## Files to Fix

### 1. Fix shared helper (highest impact)
- **packages/markform/src/cli/lib/shared.ts:181** - Change `writeFile` to use `atomically`
- This automatically fixes 5 command files that use it:
  - serve.ts:402
  - fill.ts:516, 542
  - apply.ts:198, 207
  - render.ts:79

### 2. Fix exportHelpers to use shared helper
- **packages/markform/src/cli/lib/exportHelpers.ts:142,146,156,174** - Replace 4x `writeFileSync` with `shared.writeFile`

### 3. Fix package scripts (import atomically directly)
- **packages/markform/scripts/regen-golden-sessions.ts:114** - 1x `writeFileSync`
- **packages/markform/scripts/test-live-agent.ts:228,394** - 2x `writeFileSync`

### 4. Fix CLI commands with direct writes
- **packages/markform/src/cli/commands/examples.ts:316** - 1x `writeFileSync`

### 5. Fix root scripts (import atomically directly)
- **scripts/create-changeset.ts:42** - 1x `writeFileSync`

## Notes
- `atomically` is already a dependency
- Total: ~11 call sites across 6 files
- For sync contexts, convert to async or use `atomically.writeFileSync()`
