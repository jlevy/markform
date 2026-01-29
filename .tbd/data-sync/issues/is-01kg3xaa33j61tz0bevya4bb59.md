---
close_reason: null
closed_at: 2025-12-24T01:17:10.912Z
created_at: 2025-12-23T21:42:24.048Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.062Z
    original_id: markform-109
id: is-01kg3xaa33j61tz0bevya4bb59
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Implement code coverage reporting with Vitest v8
type: is
updated_at: 2025-12-24T01:17:10.912Z
version: 1
---
Implement code coverage reporting for the markform project using Vitest with @vitest/coverage-v8.

**Reference:** docs/general/research/research-code-coverage-typescript.md

**Implementation:**
1. Install @vitest/coverage-v8
2. Configure vitest.config.ts with coverage settings:
   - Provider: v8
   - Reporters: text, text-summary, html, json, lcov
   - Exclude: generated files, .d.ts, test files, config files, dist, node_modules
   - Include: src/**/*.ts
3. Set initial thresholds (starting targets):
   - Statements: 70%
   - Branches: 65%
   - Functions: 70%
   - Lines: 70%
4. Add package.json scripts:
   - test:coverage
   - test:coverage:html (for local dev review)
5. Add coverage/ to .gitignore

**Notes:**
- Branch coverage is especially important for TypeScript (union types, optional chaining, type guards)
- Don't aim for 100% - 80-90% is the target range
