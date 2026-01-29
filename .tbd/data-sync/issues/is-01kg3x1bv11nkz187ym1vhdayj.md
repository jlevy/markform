---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:03:52.826Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.106Z
    original_id: markform-140
id: is-01kg3x1bv11nkz187ym1vhdayj
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "ROLE-012: Polish and consistency improvements"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Summary
Grouped low-priority polish items for spec consistency and quality.

## Items

### Constants Typing
- Type `DEFAULT_ROLES` as `readonly [typeof USER_ROLE, typeof AGENT_ROLE]`
- Expose helpers: `normalizeRoles(...)`, `parseRolesFlag(raw: string): string[]`

### Warnings Taxonomy
- Assign warning/error codes (e.g., MF_ROLE_UNKNOWN, MF_BLOCKING_NONREQUIRED)
- Allows `inspect` and tests to assert specific diagnostics easily

### Serializer Stability
- Document that serializer outputs `role` and `approvalMode` only when non-default
- Add golden snapshot test to ensure stable serialization across versions

### Documentation Cross-references
- Add short 'Safety' section under CLI describing overwrite protections
- Document that blocking applies across all roles based on document order

### Explicit Blocking Inclusion
- Add explicit acceptance criterion: 'the first incomplete blocking checkpoint is included so it can be completed'

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (various sections)
