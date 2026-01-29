---
close_reason: null
closed_at: 2025-12-26T23:46:59.997Z
created_at: 2025-12-24T20:55:49.926Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.393Z
    original_id: markform-184.2
id: is-01kg3x1bv2n3phkcrhxtwtx4ae
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "Spec: Fix remainingIssues priority type (1|2|3 should be number for 1-5)"
type: is
updated_at: 2025-12-26T23:46:59.997Z
version: 1
---
In plan-2025-12-24-programmatic-fill-api.md line 441, FillResult.remainingIssues specifies priority: 1 | 2 | 3. But the implementation (programmaticFill.ts:117) uses 'priority: number' to match InspectIssue's 1-5 priority tiers. Update the spec to match.
