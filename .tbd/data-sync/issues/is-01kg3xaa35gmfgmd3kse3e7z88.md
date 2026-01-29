---
close_reason: null
closed_at: 2025-12-23T09:08:36.999Z
created_at: 2025-12-23T08:31:11.120Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.701Z
    original_id: markform-1zs
id: is-01kg3xaa35gmfgmd3kse3e7z88
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "ARCH-005: Fix doc block placement rules to match fixtures"
type: is
updated_at: 2025-12-23T09:08:36.999Z
version: 1
---
## Problem
Spec says doc blocks 'must be siblings of the referenced element', but fixtures show docs nested inside `{% form %}` and `{% field-group %}` bodies.

## Evidence
- In `simple.form.md`: `{% doc ref="simple_test" %}` is inside the `{% form %}` body
- In `earnings-analysis.form.md`: group docs (e.g., `ref="offerings_primary"`) are inside the `{% field-group %}` body

This is a direct spec↔fixtures mismatch.

## Recommended Fix
Replace 'must be siblings' rule with:
1. Doc blocks MAY appear inside `form` and `field-group` as direct children
2. Doc blocks MUST NOT appear inside a field tag body (this is the actual parsing constraint)
3. For field-level docs: place immediately after the field block (sibling within the group)

This keeps field value extraction simple (the important part) without forcing awkward 'docs outside container' layout.

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (Documentation Blocks section)

## Blocks
- markform-7mt (1.2 Markdoc Parsing)
