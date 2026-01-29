---
close_reason: null
closed_at: 2025-12-23T17:29:21.918Z
created_at: 2025-12-23T08:33:54.914Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.197Z
    original_id: markform-mrh
id: is-01kg3x1bvgvh4kqky5wsqfcr67
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "FORM-COMPANY-005: Fix sources_accessed item_format pattern"
type: is
updated_at: 2025-12-23T17:32:58.457Z
version: 1
---
## Problem
`sources_accessed` `item_format` pattern doesn't enforce all 5 columns described in instructions. The docs say each item should have: Source Type | Name | URL | Access Date | Key Data Points.

## Why It Matters
- Validation may accept incomplete entries
- Instructions promise more structure than validation enforces
- Could lead to inconsistent data

## Recommended Fix
Choose ONE approach:
1. **Stricter regex:** Use pipe-count regex requiring exactly 5 segments
2. **Document limitation:** Update docs to say 'at least 3 segments required'
3. **Simpler validation:** Remove item_format, rely on doc instructions only

## Files to Update
- docs/project/test-fixtures/forms/earnings-analysis.form.md
