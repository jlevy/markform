---
close_reason: null
closed_at: 2025-12-23T09:31:58.345Z
created_at: 2025-12-23T08:33:03.798Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.405Z
    original_id: markform-kav
id: is-01kg3xaa3fyenwx4qajd7bdnf1
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "PLAN-006: Keep inspect YAML output machine-readable"
type: is
updated_at: 2025-12-23T09:31:58.345Z
version: 1
---
## Problem
Plan mentions colors and formatting, but inspect output is YAML which should remain machine-readable (no ANSI escape codes).

## Why It Matters
- YAML output needs to be pipeable to other tools
- ANSI codes would break `yq`, `jq` (after conversion), etc.
- Users may redirect output to files

## Recommended Fix
1. Use colors only in non-YAML human-readable logs/messages
2. Keep YAML output clean and parseable
3. Consider `--no-color` flag for all output if needed
4. Test that YAML output parses correctly

## Files to Update
- docs/project/plan/plan-2025-12-22-markform-v01-implementation.md (clarify in CLI tasks)
