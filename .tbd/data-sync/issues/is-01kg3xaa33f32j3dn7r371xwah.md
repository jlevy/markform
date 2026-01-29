---
close_reason: null
closed_at: 2025-12-24T01:57:23.181Z
created_at: 2025-12-23T22:14:57.142Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.130Z
    original_id: markform-122
id: is-01kg3xaa33f32j3dn7r371xwah
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "POLITICAL-001: Improve political-figure form spec"
type: is
updated_at: 2025-12-24T01:57:23.181Z
version: 1
---
Batch of improvements to the political-figure test plan.

**Changes:**
- Add explicit date pattern validation: `pattern="^\\d{4}-\\d{2}-\\d{2}$"` for date fields
- Document that `term_end` allows 'Incumbent' OR date (how to handle validation)
- Add source citation fields (`sources` string-list with format validation)
- Add note about repeating groups coming in v0.2
- Add word limit guidance for agent-generated text fields

**Files:**
- docs/project/specs/active/plan-2025-12-23-political-figure-live-agent-test.md
