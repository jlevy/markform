---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:03:41.740Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.101Z
    original_id: markform-139
id: is-01kg3x1bv1wk4v2zpxxbsmsv8s
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "ROLE-011: Add backward compatibility template per workspace rules"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
Current Backward Compatibility section is generic ('Fully backward compatible'). Workspace rules require the full template.

## Why It Matters
- Workspace rules mandate the specific template format
- Template helps ensure all compatibility concerns are addressed
- Provides clear guidance for implementers

## Recommended Fix
Replace current section with the required template:

**BACKWARD COMPATIBILITY REQUIREMENTS:**
- **Code types, methods, and function signatures**: [DO NOT MAINTAIN - new feature]
- **Library APIs**: [DO NOT MAINTAIN - additive changes only]
- **Server APIs**: [N/A]
- **File formats**: [SUPPORT BOTH - forms without roles use defaults]
- **Database schemas**: [N/A]

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (Backward Compatibility section)
