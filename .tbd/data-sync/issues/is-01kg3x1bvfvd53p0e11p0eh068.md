---
close_reason: Fixed in commit 12f7684
closed_at: 2026-01-13T02:52:04.462Z
created_at: 2026-01-12T09:22:11.037Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.841Z
    original_id: markform-595
id: is-01kg3x1bvfvd53p0e11p0eh068
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: Fix detectSyntaxStyle to ignore code blocks
type: is
updated_at: 2026-01-13T02:52:04.462Z
version: 1
---
PR #101 review: detectSyntaxStyle scans with indexOf for patterns like '<\!-- f:' but doesn't skip fenced/inline code. If a Markdoc form includes code examples, the detector wrongly chooses html-comment, breaking round-trip style preservation.
