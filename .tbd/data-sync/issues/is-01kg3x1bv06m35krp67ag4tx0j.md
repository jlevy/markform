---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:02:59.807Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.076Z
    original_id: markform-134
id: is-01kg3x1bv06m35krp67ag4tx0j
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ROLE-006: Role normalization and reserved identifiers"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
Roles are free-form strings; case/whitespace and sentinel clashes may cause bugs (e.g., literal role named '*').

## Why It Matters
- Role 'Agent' vs 'agent' could cause filtering bugs
- Whitespace in role names is likely unintentional
- '*' is reserved for CLI role selection wildcard

## Recommended Fix
1. Normalize roles on parse and CLI input: trim, toLowerCase, reject/escape whitespace
2. Reserve '*' strictly for CLI role selection; reject it as a defined role in forms (validation error)
3. Add Zod refinements: roles must be non-empty, unique, and match pattern [a-z0-9_-]+
4. Warn on unknown roles in fields vs roles list (already planned), and auto-suggest closest known role in inspect

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (add Role Validation Rules section)
- Add Zod schema refinements in Architecture section
