---
close_reason: null
closed_at: 2025-12-30T00:18:01.496Z
created_at: 2025-12-29T23:58:34.158Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.204Z
    original_id: markform-466
id: is-01kg3x1bv9v707y51jzw58vvaa
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add run_mode validation against form structure
type: is
updated_at: 2025-12-30T00:18:01.496Z
version: 1
---
Validate that run_mode matches form's field roles.

**Validation Rules:**
- run_mode=interactive → MUST have at least one role="user" field
- run_mode=fill → MUST have at least one role="agent" field
- run_mode=research → MUST have at least one role="agent" field

**Implementation:**
- Create validateRunMode(form, runMode) function
- Add validation during parse or as standalone utility
- Return descriptive error with available roles

**Files:**
- packages/markform/src/cli/lib/runMode.ts (new)
- packages/markform/src/cli/lib/index.ts (export)

**Tests:**
- run_mode=interactive with no user fields → error
- run_mode=fill with no agent fields → error
- run_mode=research with no agent fields → error
- Valid combinations pass

**Ref:** markform-462
