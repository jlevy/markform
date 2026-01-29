---
close_reason: null
closed_at: 2025-12-23T15:02:59.222Z
created_at: 2025-12-23T07:19:06.382Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.092Z
    original_id: markform-cvf
id: is-01kg3x1bvg40q3gtjfpkcae21s
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Setup CI workflow
type: is
updated_at: 2025-12-23T15:03:22.047Z
version: 1
---
Setup GitHub Actions CI workflow per research doc:

.github/workflows/ci.yml:
- Triggers: pull_request, push to main
- Jobs: test
- Steps:
  1. actions/checkout@v5
  2. pnpm/action-setup@v4 (version: 10)
  3. actions/setup-node@v6 (node-version: 24, cache: pnpm)
  4. pnpm install --frozen-lockfile
  5. pnpm lint
  6. pnpm typecheck
  7. pnpm build
  8. pnpm publint
  9. pnpm test

.github/workflows/release.yml:
- Triggers: push to main
- Permissions: contents write, pull-requests write
- Steps:
  1. actions/checkout@v5 (fetch-depth: 0)
  2. pnpm/action-setup@v4
  3. actions/setup-node@v6 (registry-url: npm)
  4. pnpm install --frozen-lockfile
  5. changesets/action@v1 (publish: pnpm release)

Repository settings note:
- Actions → Workflow permissions → Read and write

Ref: docs/project/research/current/research-modern-typescript-monorepo-package.md (Section 8)
