---
close_reason: Closed
closed_at: 2026-01-12T05:57:41.658Z
created_at: 2026-01-12T05:40:37.170Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.995Z
    original_id: markform-584
id: is-01kg3xaa3dhxhxfynqns0fxjsz
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Integrate preprocessor into parse.ts
type: is
updated_at: 2026-01-12T05:57:41.658Z
version: 1
---
## Task
Update `src/engine/parse.ts`:
- Import preprocessCommentSyntax and detectSyntaxStyle from preprocess.ts
- Call preprocessCommentSyntax() before Markdoc.parse()
- Call detectSyntaxStyle() on original input
- Store detected syntax style in ParsedForm result

## Changes
```typescript
export function parseForm(markdown: string): ParsedForm {
  const syntaxStyle = detectSyntaxStyle(markdown);
  const preprocessed = preprocessCommentSyntax(markdown);
  const ast = Markdoc.parse(preprocessed);
  // ... existing parsing logic
  return {
    ...result,
    syntaxStyle,
  };
}
```

## Files
- packages/markform/src/engine/parse.ts

## Depends On
- preprocess.ts
- coreTypes.ts update
