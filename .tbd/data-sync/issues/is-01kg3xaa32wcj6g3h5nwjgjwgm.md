---
close_reason: null
closed_at: 2025-12-23T17:27:54.143Z
created_at: 2025-12-23T08:35:44.028Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:55.995Z
    original_id: markform-069
id: is-01kg3xaa32wcj6g3h5nwjgjwgm
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add lefthook for pre-commit and pre-push hooks
type: is
updated_at: 2025-12-23T17:32:58.451Z
version: 1
---
Set up lefthook for local git hooks as part of initial project scaffolding.

**Pre-commit hooks (fast, 2-5s target):**
- Prettier formatting with auto-fix
- ESLint with cache and auto-fix
- TypeScript incremental typecheck

**Pre-push hooks (cached):**
- Full test suite with commit-hash caching
- Skip if tests already passed for current commit

See: docs/project/research/current/research-modern-typescript-monorepo-package.md (Section 9, Appendix E)
