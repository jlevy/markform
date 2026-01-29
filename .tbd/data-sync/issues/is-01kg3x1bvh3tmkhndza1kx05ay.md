---
close_reason: null
closed_at: 2025-12-23T09:39:04.651Z
created_at: 2025-12-23T08:33:52.626Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.271Z
    original_id: markform-y98
id: is-01kg3x1bvh3tmkhndza1kx05ay
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "FORM-COMPANY-002: Document required_if_equals validator"
type: is
updated_at: 2025-12-23T09:39:04.651Z
version: 1
---
## Problem
Company form uses validator `required_if_equals` but architecture only documents `required_if`. This validator is used but not specified.

## Why It Matters
- Implementers won't know how to implement this validator
- Creates gap between fixture and specification
- Could lead to different interpretations

## Recommended Fix
Choose ONE approach:
1. **Add to architecture:** Document `required_if_equals` in 'Example Custom Validators' list with signature and semantics
2. **Refactor fixture:** Change to `required_if` with `equals` parameter (e.g., `validate="required_if(field=type, equals='other')"`)

## Files to Update
Either:
- docs/project/architecture/current/arch-markform-design.md.md (if adding validator)
- docs/project/test-fixtures/forms/earnings-analysis.form.md (if refactoring)
