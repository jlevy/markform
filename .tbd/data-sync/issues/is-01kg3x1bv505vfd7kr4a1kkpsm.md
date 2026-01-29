---
close_reason: null
closed_at: 2025-12-27T23:45:21.585Z
created_at: 2025-12-27T23:24:49.831Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.278Z
    original_id: markform-268
id: is-01kg3x1bv505vfd7kr4a1kkpsm
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add round-trip integration tests for fence escaping
type: is
updated_at: 2025-12-27T23:45:21.585Z
version: 1
---
Add integration tests in serialize.test.ts for parse-serialize-parse round-trips with: values containing triple-backtick code blocks, tilde code blocks, Markdoc tags, both backticks and tildes, pathological cases with many fence chars. Verify values are preserved exactly.
