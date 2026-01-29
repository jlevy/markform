---
close_reason: null
closed_at: 2025-12-23T15:02:59.222Z
created_at: 2025-12-23T07:19:05.715Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.288Z
    original_id: markform-zt3
id: is-01kg3x1bvhemdc7rjn5eba604e
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Setup linting and changeset
type: is
updated_at: 2025-12-23T15:03:22.058Z
version: 1
---
Setup ESLint (strict type-aware) and Changesets per research doc:

ESLint (eslint.config.js - flat config):
- Type-aware using recommendedTypeChecked + stylisticTypeChecked
- projectService: true for precise cross-project types
- Rules:
  - curly: ['error', 'all']
  - brace-style: ['error', '1tbs']
  - @typescript-eslint/no-unused-vars with underscore patterns
  - @typescript-eslint/no-floating-promises: error
  - @typescript-eslint/no-misused-promises: error
  - @typescript-eslint/await-thenable: error
  - @typescript-eslint/consistent-type-imports: error
  - @typescript-eslint/no-import-type-side-effects: error
  - no-restricted-syntax for TSImportType
- Relaxed rules for test files and scripts
- Ignores: dist, node_modules, .pnpm-store

Changesets (.changeset/):
- config.json with @changesets/changelog-github
- access: public
- baseBranch: main
- README.md

Root devDependencies:
- @changesets/cli ^2.28.0
- @changesets/changelog-github ^0.5.0
- @eslint/js ^9.0.0
- eslint ^9.0.0
- typescript ^5.0.0
- typescript-eslint ^8.0.0

Ref: docs/project/research/current/research-modern-typescript-monorepo-package.md (Appendix B, C)
