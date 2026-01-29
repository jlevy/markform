---
close_reason: null
closed_at: 2025-12-24T17:42:53.340Z
created_at: 2025-12-24T17:30:53.298Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.459Z
    original_id: markform-174
id: is-01kg3xaa34zvme5d5kcff2t462
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[172.2] Update parse.ts: Parse new tag names"
type: is
updated_at: 2025-12-24T17:42:53.340Z
version: 1
---
**Parent:** markform-172
**Spec:** docs/project/specs/active/impl-2025-12-24-doc-block-syntax-simplification.md#phase-1

## Changes Required

### parse.ts

Update `extractDocBlocks()` function to:
1. Look for `{% description %}`, `{% instructions %}`, `{% documentation %}` tags instead of `{% doc %}`
2. Extract `ref` attribute (no longer need `kind` attribute)
3. Set `tag` field based on which Markdoc tag was matched
4. Update duplicate detection to key on `${ref}:${tag}`

## Files
- packages/markform/src/engine/parse.ts (lines 858-924)

## Acceptance
- Parser recognizes all three new tag types
- Throws on missing `ref` attribute
- Throws on duplicate `(ref, tag)` combinations
- Allows different tags for same ref
