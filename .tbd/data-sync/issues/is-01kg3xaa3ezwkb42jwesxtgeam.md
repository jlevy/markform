---
close_reason: null
closed_at: 2025-12-23T20:19:05.318Z
created_at: 2025-12-23T20:13:51.273Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.217Z
    original_id: markform-90
id: is-01kg3xaa3ezwkb42jwesxtgeam
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "CLI validate: add new command for summary and issues only"
type: is
updated_at: 2025-12-23T20:19:05.318Z
version: 1
---
Add new validate command that shows only summary and issues.

**Purpose:**
Quick validation check without full form content display.

**Output:**
- Form state (complete/incomplete/empty/invalid)
- Structure summary (group/field/option counts)
- Progress summary (required/submitted/complete/etc counts)
- Issues list with priority, severity, and messages

**Implementation:**
- Reuse inspect() from engine
- Reuse formatState, formatPriority, formatSeverity from inspect.ts
- Extract shared formatting helpers to lib/shared.ts or lib/format.ts
- Skip the form content section (that's what inspect does now)
- This is essentially 'inspect without form content'
