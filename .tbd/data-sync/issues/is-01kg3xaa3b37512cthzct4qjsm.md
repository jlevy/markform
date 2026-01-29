---
close_reason: null
closed_at: 2025-12-30T19:15:14.423Z
created_at: 2025-12-30T18:53:28.330Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.442Z
    original_id: markform-472
id: is-01kg3xaa3b37512cthzct4qjsm
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Unified Fill Logging Architecture
type: is
updated_at: 2025-12-30T19:15:14.423Z
version: 1
---
Consolidate and unify logging across all CLI commands (fill, run, examples) using expanded FillCallbacks.

**Spec:** docs/project/specs/active/plan-2025-12-30-unified-fill-logging.md

**Problem:**
- Duplicate logging logic in fill.ts and run.ts with inconsistent format
- TurnProgress only has counts, not actual issues/patches data  
- run.ts workflows don't receive command context
- API consumers can't get detailed progress via callbacks

**Solution:**
1. Expand FillCallbacks with onIssuesIdentified and onPatchesGenerated
2. Expand TurnProgress to include actual issues/patches arrays
3. Create createFillLoggingCallbacks() factory for CLI commands
4. Consolidate all CLI logging to use callbacks

**Phases:**
1. Expand types (no breaking changes)
2. Update programmaticFill to call new callbacks
3. Create fillLogging.ts with logging factory
4. Update CLI commands to use logging callbacks
5. Cleanup and tests
