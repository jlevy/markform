---
close_reason: Fixed in commit 12f7684
closed_at: 2026-01-13T02:52:04.462Z
created_at: 2026-01-12T09:22:19.098Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.847Z
    original_id: markform-596
id: is-01kg3x1bvfh1hmhep8me11j5x5
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: Fix postprocessToCommentSyntax to skip inline code spans
type: is
updated_at: 2026-01-13T02:52:04.462Z
version: 1
---
PR #101 review: postprocessToCommentSyntax only skips fenced code blocks, not inline code spans. In a comment-syntax form that documents Markdoc usage (e.g. 'use `{% field %}`'), serialization will mutate the literal snippet into '<\!-- f:field -->', corrupting the text.
