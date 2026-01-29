---
close_reason: null
closed_at: 2025-12-26T23:40:29.235Z
created_at: 2025-12-26T21:45:34.668Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.077Z
    original_id: markform-255.3
id: is-01kg3x1bv4keaa10267m7yjpzc
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "coreTypes.ts: Refactor ProgressCounts to three dimensions"
type: is
updated_at: 2025-12-26T23:40:29.235Z
version: 1
---
Phase 3: ProgressCounts refactor
- Rename emptyFields -> unansweredFields (AnswerState dimension)
- Add validFields (Validity dimension)
- Add new emptyFields + filledFields (Value dimension)
- Remove completeFields, incompleteFields, emptyOptionalFields
- Update ProgressCountsSchema
