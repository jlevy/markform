---
close_reason: null
closed_at: 2025-12-24T02:43:03.237Z
created_at: 2025-12-24T02:07:11.929Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.162Z
    original_id: markform-149.2
id: is-01kg3x1bv1b42nkfdxn4sq7tvj
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 2: Update parser to extract roles from frontmatter and fields"
type: is
updated_at: 2025-12-24T02:43:03.237Z
version: 1
---
## Goal
Parse roles from YAML frontmatter and field attributes.

## Changes to parse.ts
- Update frontmatter parsing to extract `roles` and `role_instructions`
- Apply `DEFAULT_ROLES` when not specified
- Extract `role` attribute from all field types, default to `AGENT_ROLE`
- Extract `approvalMode` from checkbox fields, default to 'none'
- Add parse error if `approvalMode` used on non-checkbox field
- Add validation warning for role not in form's roles list
- Add warning if `approvalMode="blocking"` but `required=false`
- Return `metadata` in ParsedForm

## Dependencies
- Uses constants from settings.ts (Phase 1)
- Uses types from types.ts (Phase 1)

## Files
- packages/markform/src/engine/parse.ts

## Tests
- Test parsing roles from frontmatter
- Test parsing role_instructions
- Test default role assignment (agent)
- Test role parsing from field attributes
- Test approvalMode parsing on checkboxes
- Test error on approvalMode on non-checkbox fields
