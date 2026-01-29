---
close_reason: null
closed_at: 2025-12-24T02:43:03.185Z
created_at: 2025-12-24T02:06:56.221Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.289Z
    original_id: markform-149.1
id: is-01kg3xaa34sbx087s1kq3pvbke
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 1: Add role types and constants to settings.ts and types.ts"
type: is
updated_at: 2025-12-24T02:43:03.185Z
version: 1
---
## Goal
Add all type definitions and constants without breaking existing code.

## Changes to settings.ts
- Add `AGENT_ROLE`, `USER_ROLE`, `DEFAULT_ROLES` constants
- Add `DEFAULT_ROLE_INSTRUCTIONS` record
- Add `ROLE_NAME_PATTERN` regex
- Add `RESERVED_ROLE_NAMES` array
- Add `normalizeRole()` helper function
- Add `parseRolesFlag()` helper function

## Changes to types.ts
- Add `FillMode` type: 'continue' | 'overwrite'
- Add `ApprovalMode` type: 'none' | 'blocking'
- Add `FormMetadata` interface with roles and roleInstructions
- Add `role: string` to FieldBase interface
- Add `approvalMode: ApprovalMode` to CheckboxesField interface
- Add optional `metadata?: FormMetadata` to ParsedForm
- Add `blockedBy?: Id` to InspectIssue interface
- Add Zod schemas for all new types
- Update field Zod schemas to include role

## Files
- packages/markform/src/settings.ts
- packages/markform/src/engine/types.ts

## Acceptance
- All new types have Zod schemas
- Existing code still compiles (types are additive)
