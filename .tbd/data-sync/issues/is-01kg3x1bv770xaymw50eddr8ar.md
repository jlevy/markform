---
close_reason: null
closed_at: 2025-12-29T03:15:28.070Z
created_at: 2025-12-28T09:56:18.051Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.756Z
    original_id: markform-371
id: is-01kg3x1bv770xaymw50eddr8ar
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: Fields and instructions should work outside field-groups
type: is
updated_at: 2025-12-29T03:15:28.070Z
version: 1
---
When a field (e.g., string-field) and its associated instructions block are placed outside of a field-group (directly under the form tag), parsing fails with: 'instructions block references unknown ID'.

**Current behavior:**
- Placing a field outside a field-group causes instruction ref resolution to fail
- Example: `{% string-field id="movie" ... %}` followed by `{% instructions ref="movie" %}` fails when not inside a field-group

**Expected behavior:**
- Fields should be valid both inside and outside field-groups
- Instructions should resolve refs to fields regardless of whether the field is in a field-group
- Instructions should work whether placed BEFORE or AFTER the field they reference (order shouldn't matter, only that ref matches id)

**Verified working (inside field-groups):**
- Instructions AFTER field: works
- Instructions BEFORE field: works

**Not working (outside field-groups):**
- Any field with instructions outside a field-group fails ref resolution

**Reproduction:**
1. Create a form with a field directly under the form tag (not wrapped in field-group)
2. Add an instructions block referencing that field (before or after)
3. Run `markform inspect <file>`
4. Error: 'instructions block references unknown ID'

**Workaround:**
Wrap all fields in field-groups (even if there's only one field per group).
