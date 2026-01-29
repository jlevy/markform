---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:02:34.813Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.058Z
    original_id: markform-131
id: is-01kg3x1bv0bxqq61bj8hpahk5s
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "ROLE-003: Document YAML to TypeScript property name mapping"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
YAML frontmatter uses snake_case (`role_instructions`, `markform_version`) but TypeScript uses camelCase (`roleInstructions`, `markformVersion`). This is fine but must be explicitly documented to avoid drift.

## Why It Matters
- Parser/serializer must transform correctly
- Implementers need clear rules
- Round-trip serialization must preserve semantics

## Recommended Fix
1. Declare explicit YAML→TS mapping rules in the spec (snake_case → camelCase)
2. Add Zod schema transforms to normalize: `markform_version` → `markformVersion`, `role_instructions` → `roleInstructions`
3. Add tests to assert transform and round-trip serialization behavior
4. Note that Markdoc attributes use camelCase (e.g., `approvalMode`, not `approval_mode`)

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (add Property Naming Conventions section)
