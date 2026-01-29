---
close_reason: null
closed_at: 2025-12-27T17:00:00.000Z
created_at: 2025-12-27T08:52:10.837Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.208Z
    original_id: markform-261.6
id: is-01kg3x1bv54q0399pqcj98vjfa
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Validator: date format and min/max"
type: is
updated_at: 2025-12-27T17:00:00.000Z
version: 1
---
Add validateDateField() in validate.ts. Validate YYYY-MM-DD format (default), custom formats, min/max date constraints. Handle impossible dates (Feb 30).
