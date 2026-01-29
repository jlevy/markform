---
close_reason: null
closed_at: 2025-12-24T02:55:03.420Z
created_at: 2025-12-24T02:07:57.097Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.310Z
    original_id: markform-149.5
id: is-01kg3xaa34x5b0rt11jmx6rj5r
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 5: Update serializer to output role and approvalMode"
type: is
updated_at: 2025-12-24T02:55:03.420Z
version: 1
---
## Goal
Output role and approvalMode attributes when non-default in serialized output.

## Changes to serialize.ts
- Update field serialization to include `role` when != AGENT_ROLE
- Update checkboxes serialization to include `approvalMode` when != 'none'
- Update frontmatter serialization to include:
  - `roles` list when != DEFAULT_ROLES
  - `role_instructions` when present

## Serialization Rules
- Attributes only output when non-default (keeps forms clean)
- Role order: alphabetical with other attributes via serializeAttrs()
- Frontmatter uses snake_case (role_instructions)

## Files
- packages/markform/src/engine/serialize.ts

## Tests
- Test role attribute only output when non-default
- Test approvalMode attribute only output when non-default
- Test frontmatter with roles and role_instructions
- Test round-trip stability (parse -> serialize -> parse)
