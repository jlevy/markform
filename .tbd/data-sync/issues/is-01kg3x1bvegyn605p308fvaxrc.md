---
close_reason: Implemented best-effort patch application with value coercion
closed_at: 2026-01-03T06:22:49.637Z
created_at: 2026-01-03T06:01:28.781Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.554Z
    original_id: markform-542
id: is-01kg3x1bvegyn605p308fvaxrc
kind: feature
labels: []
parent_id: null
priority: 1
status: closed
title: Implement best-effort patch application with value coercion
type: is
updated_at: 2026-01-03T06:34:13.184Z
version: 1
---
## Overview

Change Markform's patch application from all-or-nothing transaction semantics to best-effort (apply valid patches, reject invalid ones) with automatic value coercion.

**Plan Spec:** docs/project/specs/active/plan-2026-01-02-best-effort-patch-application.md

## Why

- LLMs make mistakes; rejecting all patches for one error wastes valid work
- Creates Sisyphean retry loops (agent retries all 15 patches, makes different mistake)
- Form fields are independent; partial state is normal during filling

## Key Changes

1. Apply valid patches even when some fail
2. Add automatic coercion (single string → array for list fields)
3. Return 'applied' / 'partial' / 'rejected' status
4. Track appliedPatches, warnings, rejectedPatches separately

## Coercions

- Single string → string_list array
- Single URL → url_list array  
- Single option ID → multi_select array
- Boolean → checkbox string (already implemented)
