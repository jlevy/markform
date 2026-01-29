---
close_reason: null
closed_at: 2025-12-26T23:46:59.977Z
created_at: 2025-12-24T20:55:43.826Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.516Z
    original_id: markform-184.1
id: is-01kg3xaa349nqqk6g6ng39r3g4
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "Spec: Fix remainingIssues severity type ('optional' should be 'recommended')"
type: is
updated_at: 2025-12-26T23:46:59.977Z
version: 1
---
In plan-2025-12-24-programmatic-fill-api.md lines 440-442, FillResult.remainingIssues specifies severity: 'required' | 'optional'. But the implementation (programmaticFill.ts:115-117) correctly uses 'required' | 'recommended' to match InspectIssue. Update the spec to match the implementation.
