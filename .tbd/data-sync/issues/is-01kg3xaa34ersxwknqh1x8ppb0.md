---
close_reason: null
closed_at: 2025-12-24T01:32:35.730Z
created_at: 2025-12-24T01:28:10.761Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.261Z
    original_id: markform-145
id: is-01kg3xaa34ersxwknqh1x8ppb0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Test harness issue filtering for groups/fields per turn
type: is
updated_at: 2025-12-24T01:32:35.730Z
version: 1
---
## Overview

Add unit tests for the issue filtering logic introduced in markform-144. Tests should verify that the harness correctly limits issues by group and field counts before passing to the agent.

## Test Cases

### 1. maxFieldsPerTurn filtering
- Form with 10 required fields, maxFieldsPerTurn=3 → only 3 issues per step
- Verify issues are priority-ranked (required before optional)
- Verify filtering respects existing maxIssues cap

### 2. maxGroupsPerTurn filtering  
- Form with 3 groups, each with 5 fields, maxGroupsPerTurn=1 → only fields from 1 group per step
- Verify group selection is deterministic (first incomplete group)
- Verify fields within group still respect maxFieldsPerTurn

### 3. Combined filtering
- maxFieldsPerTurn=5, maxGroupsPerTurn=2 → max 5 fields from max 2 groups
- Test edge case: group has fewer fields than maxFieldsPerTurn

### 4. Turn count verification
- Create form where filtering should result in predictable turn count
- Example: 12 fields, maxFieldsPerTurn=4 → should complete in 3 turns (with mock agent)
- This validates the whole filtering → agent → apply loop

## Implementation Notes

- Use createMockAgent with a fully-filled form as source
- Mock agent will always produce correct patches for shown issues
- Count actual turns taken vs expected turns
- Tests go in packages/markform/src/harness/__tests__/harness.test.ts

## Acceptance Criteria
- [ ] Tests cover all filtering scenarios above
- [ ] Tests verify expected turn counts match actual
- [ ] Tests pass with both defaults and custom limits
