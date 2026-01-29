---
close_reason: null
closed_at: 2025-12-23T21:05:37.028Z
created_at: 2025-12-23T20:24:26.880Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.242Z
    original_id: markform-95
id: is-01kg3xaa3e8aca420jzyze6322
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add pnpm precommit target for unified quality gates
type: is
updated_at: 2025-12-23T21:05:37.028Z
version: 1
---
Add a unified `pnpm precommit` script that runs all quality gates similar to CI:

**Should include:**
- Prettier check (or fix)
- ESLint with cache
- TypeScript typecheck
- Test suite

**Documentation:**
- Document in docs/development.md as the standard process before committing
- Make it clear this is what developers should run locally

**Integration:**
- Use this target from lefthook pre-commit/pre-push hooks (see markform-069)
- Ensures consistency between local hooks and CI

**Reference:**
- Related: markform-069 (lefthook setup)
- See: docs/project/research/current/research-modern-typescript-monorepo-package.md (Section 9)
