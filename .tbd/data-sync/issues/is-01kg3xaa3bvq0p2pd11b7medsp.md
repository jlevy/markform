---
close_reason: null
closed_at: 2025-12-31T20:28:14.470Z
created_at: 2025-12-31T20:09:10.777Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.507Z
    original_id: markform-483
id: is-01kg3xaa3bvq0p2pd11b7medsp
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 2: Add GitHub Actions coverage reporting"
type: is
updated_at: 2025-12-31T20:28:14.470Z
version: 1
---
Add coverage reporting to CI workflow:

- Replace 'pnpm test' with 'pnpm test:coverage' in CI
- Add vitest-coverage-report-action@v2 for PR comments
- Configure for monorepo paths (packages/markform/coverage/)
- Set file-coverage-mode: changes for PR-only file reports
- Add coverage artifact upload step

Files to modify:
- .github/workflows/ci.yml

Ref: docs/project/specs/active/plan-2025-12-31-code-coverage-implementation.md
