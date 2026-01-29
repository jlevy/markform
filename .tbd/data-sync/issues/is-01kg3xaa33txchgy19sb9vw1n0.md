---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:03:33.908Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.218Z
    original_id: markform-138
id: is-01kg3xaa33txchgy19sb9vw1n0
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "ROLE-010: Multi-form scoping clarification"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
The spec doesn't state whether blocking and role config are per-form or cross-form when a file contains multiple forms.

## Why It Matters
- Ambiguity could lead to incorrect implementations
- Cross-form blocking would be surprising and likely unwanted
- Need to be explicit about scope boundaries

## Recommended Fix
State explicitly that roles, instructions, and blocking are scoped per `form` tag:
- Each form has its own roles list and role_instructions
- Blocking checkpoints only affect fields within the same form
- No cross-form blocking behavior

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (add clarification in Form Syntax or Background section)
