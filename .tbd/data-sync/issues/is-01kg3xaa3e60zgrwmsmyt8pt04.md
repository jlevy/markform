---
close_reason: Implemented in commit 28b947a
closed_at: 2026-01-12T06:33:10.924Z
created_at: 2026-01-12T05:41:24.128Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.017Z
    original_id: markform-588
id: is-01kg3xaa3e60zgrwmsmyt8pt04
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Update serializeForm() to preserve syntax style
type: is
updated_at: 2026-01-12T06:33:10.924Z
version: 1
---
## Task
Update `src/engine/serialize.ts` serializeForm():
- Add optional `syntaxStyle?: SyntaxStyle` parameter to SerializeOptions
- If not specified, use form.syntaxStyle (preserve original)
- If syntaxStyle is 'html-comment', call postprocessToCommentSyntax() on output
- Fallback to 'markdoc' if not detected

## API
```typescript
export interface SerializeOptions {
  specVersion?: string;
  syntaxStyle?: SyntaxStyle;  // NEW
}

export function serializeForm(form: ParsedForm, opts?: SerializeOptions): string {
  // ... existing serialization
  const style = opts?.syntaxStyle ?? form.syntaxStyle ?? 'markdoc';
  if (style === 'html-comment') {
    return postprocessToCommentSyntax(result);
  }
  return result;
}
```

## Files
- packages/markform/src/engine/serialize.ts

## Depends On
- postprocessToCommentSyntax() implementation
