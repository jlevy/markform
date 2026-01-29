---
close_reason: null
closed_at: 2025-12-23T20:13:18.919Z
created_at: 2025-12-23T19:56:18.215Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.978Z
    original_id: markform-89
id: is-01kg3x1bvgmtqbtp3946p20y65
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Implement tiered priority system for inspect issues
type: is
updated_at: 2025-12-23T20:13:18.919Z
version: 1
---
Replace sequential issue numbering (P1, P2, P3...) with tiered priority levels.

## Current Problem
Issues are numbered sequentially (P1-P217), which doesn't communicate actual importance.

## Proposed Design

### Schema Addition
Add `priority` field to ValidationIssue with values: "high", "medium", "low"

### Issue Scoring
- Required field missing = 3 points
- Validation error = 2 points  
- Optional field missing = 1 point

### Priority Calculation
Priority is derived from sum of issue scores:
- P1: total_score >= 5
- P2: total_score >= 4
- P3: total_score >= 3
- P4: total_score >= 2
- P5: total_score >= 1

### Console Formatting
Consistent coloring across all commands:
- P1: bold red
- P2: yellow
- P3: cyan
- P4: blue
- P5: dim/gray

## Tasks
1. Update ValidationIssue interface with priority field
2. Implement scoring logic in inspect command
3. Update console formatters for consistent P1-P5 coloring
4. Update architecture doc to reflect this design
