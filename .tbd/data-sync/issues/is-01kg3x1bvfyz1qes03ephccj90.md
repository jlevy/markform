---
close_reason: Implemented with strict validation support
closed_at: 2026-01-13T03:24:45.953Z
created_at: 2026-01-12T05:42:24.932Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.830Z
    original_id: markform-593
id: is-01kg3x1bvfyz1qes03ephccj90
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add --syntax option to validate command (optional)
type: is
updated_at: 2026-01-13T03:24:45.953Z
version: 1
---
## Task
Update `src/cli/commands/validate.ts` to add a `--syntax` option with **strict validation**:
- Add `--syntax` option with values `'comments'` | `'tags'`
- **Strict validation**: When `--syntax` is provided, enforce that the input file uses ONLY that syntax
  - If `--syntax=comments`: fail if any `{% ... %}` patterns found  
  - If `--syntax=tags`: fail if any `<\!-- f:... -->` or `<\!-- #... -->` patterns found
  - Error message should identify the line/pattern that violates the constraint
- Pass syntax style to `serializeForm()` when outputting
- Default (no option): permissive, preserve original syntax

## Usage
```bash
# Strict validation (fails if file contains Markdoc syntax)
markform validate myform.form.md --syntax=comments

# Strict validation (fails if file contains comment syntax)
markform validate myform.form.md --syntax=tags

# Permissive validation (accepts either/both syntaxes, default)
markform validate myform.form.md
```

## Implementation
1. Add `validateSyntaxConsistency()` helper function to scan for patterns of the wrong syntax
2. Update validate command to call this when `--syntax` is provided
3. Output in specified syntax when outputting

## Files
- packages/markform/src/cli/commands/validate.ts (MODIFY)
- packages/markform/src/engine/preprocess.ts (MODIFY - add helper)

## Depends On
- Phase 1 & 2 complete
