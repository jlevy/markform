---
close_reason: null
closed_at: 2025-12-28T05:24:01.190Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.610Z
    original_id: markform-318
id: is-01kg3xaa383mw1wzcrw1r2h189
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add llms.test.ts unit tests
type: is
updated_at: 2025-12-28T05:24:01.190Z
version: 1
---
Unit tests for new src/llms.ts module.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Test Plan)

Create tests/unit/llms.test.ts:
- getWebSearchProviders() returns ['openai', 'google', 'xai']
- hasWebSearchSupport('openai') returns true
- hasWebSearchSupport('anthropic') returns false
- isWebSearchModel('openai/gpt-4o') returns true
- isWebSearchModel('anthropic/claude-3-5-sonnet') returns false
- formatWebSearchModels() includes all web-search providers
- All existing imports work after refactoring
