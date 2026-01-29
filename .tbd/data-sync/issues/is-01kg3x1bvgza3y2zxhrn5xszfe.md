---
close_reason: null
closed_at: 2025-12-23T20:17:51.512Z
created_at: 2025-12-23T20:14:54.443Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.998Z
    original_id: markform-92
id: is-01kg3x1bvgza3y2zxhrn5xszfe
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "CLI inspect: add full form structure display"
type: is
updated_at: 2025-12-23T20:17:51.512Z
version: 1
---
Enhance inspect command to show full form structure in addition to summary and issues.

**Current behavior:**
- Shows form_state, structure counts, progress counts, and issues

**Desired behavior:**
- Add full form content display (groups → fields → values)
- Reuse formatFieldValue and group/field display logic from export command
- Order: summary (structure/progress) → form content → issues
- This makes inspect the 'verbose overview' command

**Implementation:**
- Import formatFieldValue helper (or extract to shared module)
- Add form content section showing groups, fields, and current values
- Keep existing summary and issues sections
