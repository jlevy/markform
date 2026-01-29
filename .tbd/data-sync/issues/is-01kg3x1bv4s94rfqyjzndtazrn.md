---
close_reason: null
closed_at: 2025-12-27T00:37:42.504Z
created_at: 2025-12-27T00:14:13.956Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.118Z
    original_id: markform-257
id: is-01kg3x1bv4s94rfqyjzndtazrn
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Add 'markform spec' CLI command to print specification
type: is
updated_at: 2025-12-27T00:37:42.504Z
version: 1
---
Add a new CLI command 'markform spec' that prints the Markform specification document.

Similar to how 'markform instructions' (soon 'markform readme') prints the README, this command should print the standalone specification document (markform-spec.md once markform-256 is complete).

Implementation:
- Add 'spec' command to CLI
- Load and print the spec document from the package
- Bundle the spec.md file with the package (similar to README)

Depends on markform-256 (spec extraction) being completed first.
