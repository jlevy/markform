---
close_reason: null
closed_at: 2025-12-23T15:02:24.951Z
created_at: 2025-12-23T07:19:43.082Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.044Z
    original_id: markform-aae
id: is-01kg3x1bvgmkvxj4png4r2d7m8
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: 1.5 Validation (engine/validate.ts)
type: is
updated_at: 2025-12-23T15:03:22.041Z
version: 1
---
Implement validate(form: ParsedForm, opts?): ValidationResult
- Built-in validators (required, patterns, ranges, counts, checkboxes)
- Code validator loading via jiti
- Validator execution and error collection
- Unit tests for all validation rules
