---
close_reason: null
closed_at: 2025-12-27T00:25:26.729Z
created_at: 2025-12-27T00:14:19.235Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.273Z
    original_id: markform-258
id: is-01kg3xaa37dmshkt56qk86epps
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Rename 'markform instructions' to 'markform readme'
type: is
updated_at: 2025-12-27T00:25:26.729Z
version: 1
---
Simplify the CLI by renaming 'markform instructions' to just 'markform readme'.

Previously both names were supported as aliases. Simplify to just 'readme':
- Remove 'instructions' command/alias
- Keep only 'markform readme'
- Update any documentation references

This is a minor cleanup for CLI consistency.
