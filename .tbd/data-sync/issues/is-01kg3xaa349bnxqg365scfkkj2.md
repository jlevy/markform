---
close_reason: null
closed_at: 2025-12-24T17:42:53.291Z
created_at: 2025-12-24T17:30:52.162Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.454Z
    original_id: markform-173
id: is-01kg3xaa349bnxqg365scfkkj2
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[172.1] Update types.ts: DocumentationTag and DocumentationBlock"
type: is
updated_at: 2025-12-24T17:42:53.291Z
version: 1
---
**Parent:** markform-172
**Spec:** docs/project/specs/active/impl-2025-12-24-doc-block-syntax-simplification.md#phase-1

## Changes Required

### types.ts

1. Replace `DocBlockKind` with `DocumentationTag`:
   ```typescript
   export type DocumentationTag = "description" | "instructions" | "documentation";
   ```

2. Update `DocumentationBlock` interface:
   ```typescript
   export interface DocumentationBlock {
     tag: DocumentationTag;
     ref: string;
     bodyMarkdown: string;
   }
   ```

3. Update Zod schemas:
   - `DocBlockKindSchema` → `DocumentationTagSchema`
   - Update `DocumentationBlockSchema` to use `tag` (required) instead of `kind` (optional)

## Files
- packages/markform/src/engine/types.ts (lines 226-237, 767-778)

## Acceptance
- Types compile without errors
- Zod schemas validate correctly
