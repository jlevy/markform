---
close_reason: Closed
closed_at: 2026-01-12T05:57:41.658Z
created_at: 2026-01-12T05:40:57.394Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.005Z
    original_id: markform-586
id: is-01kg3xaa3dsehynptj00kvc254
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add integration tests for comment syntax parsing
type: is
updated_at: 2026-01-12T05:57:41.658Z
version: 1
---
## Task
Create `tests/unit/engine/parse-comment.test.ts`:

## Test Cases
- Parse comment-syntax form produces valid ParsedForm
- Verify identical AST for equivalent Markdoc vs comment forms
- syntaxStyle is correctly set to 'html-comment'
- Complex form with groups, fields, annotations
- Form with values in both syntaxes

## Files
- packages/markform/tests/unit/engine/parse-comment.test.ts

## Depends On
- preprocess.ts
- parse.ts integration
