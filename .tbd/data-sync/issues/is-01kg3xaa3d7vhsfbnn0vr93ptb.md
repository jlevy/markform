---
close_reason: Closed
closed_at: 2026-01-12T05:57:41.658Z
created_at: 2026-01-12T05:40:26.212Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.989Z
    original_id: markform-583
id: is-01kg3xaa3d7vhsfbnn0vr93ptb
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add SyntaxStyle to coreTypes.ts and ParsedForm
type: is
updated_at: 2026-01-12T05:57:41.658Z
version: 1
---
## Task
Update `src/engine/coreTypes.ts`:
- Add `SyntaxStyle` type export (or re-export from preprocess.ts)
- Add `syntaxStyle?: SyntaxStyle` to `ParsedForm` type

## Files
- packages/markform/src/engine/coreTypes.ts

## Depends On
- preprocess.ts must be created first (defines SyntaxStyle)
