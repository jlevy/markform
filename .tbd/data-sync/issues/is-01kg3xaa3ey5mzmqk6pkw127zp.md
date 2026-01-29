---
close_reason: null
closed_at: 2025-12-23T21:05:37.028Z
created_at: 2025-12-23T20:47:42.463Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.258Z
    original_id: markform-98
id: is-01kg3xaa3ey5mzmqk6pkw127zp
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Create global settings.ts for consolidated constants
type: is
updated_at: 2025-12-23T21:05:37.028Z
version: 1
---
Create a single src/settings.ts file to consolidate global constants that are non-changing but currently scattered across files.

**Initial candidates:**
- DEFAULT_PORT (serve command, currently 3344)
- DEFAULT_MAX_TURNS (harness, currently 50)
- DEFAULT_MAX_PATCHES_PER_TURN (harness, currently 20)
- DEFAULT_MAX_ISSUES (harness, currently 10)
- DEFAULT_MODEL (fill command, e.g., anthropic:claude-sonnet-4-5)
- Any other hardcoded values that should be configurable or centralized

**Benefits:**
- Single place to find/modify global defaults
- Easier to document and maintain
- Clear separation from runtime configuration
- Consistent defaults across CLI and programmatic usage

**Location:** src/settings.ts (or src/lib/settings.ts)
