---
close_reason: null
closed_at: 2025-12-28T02:32:57.642Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.535Z
    original_id: markform-303
id: is-01kg3xaa382dsj2xys0j4cs9p4
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 1.1: Add research defaults to settings.ts"
type: is
updated_at: 2025-12-28T02:32:57.642Z
version: 1
---
Add research-specific default constants to settings.ts.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 1)

Add constants:
- RESEARCH_DEFAULT_MAX_ISSUES_PER_TURN = 3 (research uses focused issues)
- RESEARCH_DEFAULT_MAX_GROUPS_PER_TURN = 1 (one section at a time)

These are used by harnessConfigResolver.ts for RESEARCH_DEFAULTS.
