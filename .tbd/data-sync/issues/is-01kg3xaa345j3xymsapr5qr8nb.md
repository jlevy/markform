---
close_reason: null
closed_at: 2025-12-24T04:33:21.693Z
created_at: 2025-12-24T02:08:22.570Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.321Z
    original_id: markform-149.7
id: is-01kg3xaa345j3xymsapr5qr8nb
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 7: Update example forms to use role system"
type: is
updated_at: 2025-12-24T04:33:21.693Z
version: 1
---
## Goal
Update bundled examples to demonstrate the role system.

## Forms to Update
1. simple.form.md - Add `role="user"` to 1-2 fields
2. political-figure.form.md - Add `role="user"` to name field
3. earnings-analysis.form.md (if exists) - Add user role to company identifier fields

## Changes per Form
- Add `roles: [user, agent]` to frontmatter
- Add `role_instructions` for each role
- Add `role="user"` to context/seed fields

## Files
- packages/markform/examples/simple/simple.form.md
- Other example forms

## Acceptance
- Each example parses correctly with role attributes
- Two-stage workflow works: `fill --interactive` then `fill`
