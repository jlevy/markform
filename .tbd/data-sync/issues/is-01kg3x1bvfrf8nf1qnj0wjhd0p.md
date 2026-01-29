---
close_reason: Closed
closed_at: 2026-01-12T05:57:41.658Z
created_at: 2026-01-12T05:40:16.376Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.769Z
    original_id: markform-582
id: is-01kg3x1bvfrf8nf1qnj0wjhd0p
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Create preprocess.ts with SyntaxStyle type and preprocessor
type: is
updated_at: 2026-01-12T05:57:41.658Z
version: 1
---
## Task
Create `src/engine/preprocess.ts` with:
- `SyntaxStyle` type definition (`'markdoc' | 'html-comment'`)
- `preprocessCommentSyntax(markdown: string): string` function
- `detectSyntaxStyle(markdown: string): SyntaxStyle` function
- State machine for code block detection (skip fenced/inline code)

## Patterns to Transform
- `<!-- f:tag ... -->` → `{% tag ... %}`
- `<!-- /f:tag -->` → `{% /tag %}`
- `<!-- f:tag /--> ` → `{% tag /%}`
- `<!-- #id -->` → `{% #id %}`
- `<!-- .class -->` → `{% .class %}`

## References
- Plan Spec: docs/project/specs/active/plan-2026-01-12-html-comment-syntax-support.md (Appendix A)
- Similar pattern: serialize.ts pickFence() for code block detection
