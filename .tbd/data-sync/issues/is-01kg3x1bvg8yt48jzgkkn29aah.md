---
close_reason: null
closed_at: 2025-12-23T17:30:26.804Z
created_at: 2025-12-23T08:33:53.370Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.213Z
    original_id: markform-ncq
id: is-01kg3x1bvg8yt48jzgkkn29aah
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "FORM-COMPANY-003: Align word count docs with validation constraints"
type: is
updated_at: 2025-12-23T17:32:58.459Z
version: 1
---
## Problem
Several fields in company form say '25-75 words' in docs but use `minLength`/`maxLength` (character-based validation).

Example: `how_makes_money` says '25-75 words' but uses `minLength=100 maxLength=300`.

## Why It Matters
- Confusing for form fillers: which constraint applies?
- Character count != word count
- Could cause valid responses to fail validation or vice versa

## Recommended Fix
Choose ONE approach:
1. **Add word validators:** Implement `min_words`/`max_words` validators for word-based constraints
2. **Update doc text:** Change '25-75 words' to '100-300 characters' to match actual validation

## Files to Update
- docs/project/test-fixtures/forms/earnings-analysis.form.md
