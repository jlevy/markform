---
close_reason: null
closed_at: 2025-12-23T09:39:14.684Z
created_at: 2025-12-23T08:33:51.083Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:55.985Z
    original_id: markform-055
id: is-01kg3xaa31pt3kny1ekw93vmnr
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "FORM-SIMPLE-001: Clarify requiredness for minItems/minSelections fields"
type: is
updated_at: 2025-12-23T09:39:14.684Z
version: 1
---
## Problem
In `simple.form.md`:
- `tags` has `minItems=1` but no `required=true`
- `categories` has `minSelections=1` but no `required=true`

This is ambiguous given the spec wording around required vs min constraints.

## Why It Matters
- Behavior differs depending on whether min constraints imply requiredness
- Progress/form_state computation could be inconsistent with validation
- Creates confusion for implementers and users

## Recommended Fix
After ARCH-013 decision, either:
1. Add `required=true` to both fields (clearest, recommended)
2. Remove min constraints and rely solely on `required=true`
3. Keep as-is if spec clarifies min constraints DON'T imply requiredness

## Files to Update
- docs/project/test-fixtures/forms/simple.form.md
- docs/project/test-fixtures/forms/simple-mock-filled.form.md (if needed)

## Depends On
- ARCH-013 (need decision on min constraints vs requiredness first)
