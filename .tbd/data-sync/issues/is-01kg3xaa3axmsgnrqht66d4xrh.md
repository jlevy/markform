---
close_reason: null
closed_at: 2025-12-29T03:29:41.138Z
created_at: 2025-12-29T02:37:56.613Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.190Z
    original_id: markform-424
id: is-01kg3xaa3axmsgnrqht66d4xrh
kind: feature
labels: []
parent_id: null
priority: 1
status: closed
title: "Spec: Unified Field Tag Syntax Implementation"
type: is
updated_at: 2025-12-29T04:05:01.025Z
version: 1
---
Replace 11 distinct field tags with single unified `{% field kind="..." %}` syntax.

**Spec:** docs/project/specs/active/plan-2025-12-28-unified-field-tag.md

**Summary:**
- Replace string-field, number-field, etc. with `{% field kind="string" %}`
- Update serializer to output new syntax
- Migrate all form files and tests
- Update parser to reject legacy tags
- Update all documentation

**Implementation Order (per spec):**
1. Serializer update (output new syntax)
2. Form file migration
3. Unit test migration  
4. Parser update (reject legacy tags)
5. Documentation update
6. Final validation
