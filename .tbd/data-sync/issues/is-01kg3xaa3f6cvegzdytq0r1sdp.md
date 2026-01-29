---
close_reason: null
closed_at: 2025-12-23T15:02:59.222Z
created_at: 2025-12-23T07:19:07.022Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.446Z
    original_id: markform-o8l
id: is-01kg3xaa3f6cvegzdytq0r1sdp
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Create placeholder src and tests
type: is
updated_at: 2025-12-23T15:03:22.055Z
version: 1
---
Create placeholder source and tests to verify tooling:

src/index.ts:
- Export package version from package.json
- Export placeholder types

tests/unit/index.test.ts:
- Basic test using vitest
- Import and verify version export works

Verify all commands pass:
- pnpm install (from root)
- pnpm build
- pnpm typecheck
- pnpm lint
- pnpm publint
- pnpm test

Add vitest to package devDependencies:
- vitest ^3.0.0

Package scripts:
- test: vitest run
- test:watch: vitest
