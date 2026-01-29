---
close_reason: Implemented in commit 28b947a
closed_at: 2026-01-12T06:33:10.924Z
created_at: 2026-01-12T05:41:33.668Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.809Z
    original_id: markform-589
id: is-01kg3x1bvfgth1f4f1qpwhjxz4
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add unit tests for comment syntax serialization
type: is
updated_at: 2026-01-12T06:33:10.924Z
version: 1
---
## Task
Create `tests/unit/engine/serialize-comment.test.ts`:

## Test Cases
- postprocessToCommentSyntax() transforms correctly
- serializeForm() outputs comment syntax when form.syntaxStyle is 'html-comment'
- serializeForm() outputs Markdoc syntax when form.syntaxStyle is 'markdoc'
- Round-trip: comment → parse → serialize → identical comment
- Round-trip: markdoc → parse → serialize → identical markdoc
- Forced syntax override via SerializeOptions

## Files
- packages/markform/tests/unit/engine/serialize-comment.test.ts

## Depends On
- postprocessToCommentSyntax() implementation
- serializeForm() update
