---
close_reason: null
closed_at: 2025-12-24T06:57:25.739Z
created_at: 2025-12-24T06:18:06.661Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.213Z
    original_id: markform-154
id: is-01kg3x1bv11ggm0gbw1x6hg54b
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add tests for examples command
type: is
updated_at: 2025-12-24T06:57:25.739Z
version: 1
---
Create unit tests for the examples command.

Tests to write:
1. Example registry has all required fields (id, title, description, filename, content)
2. All example content modules export valid form markdown
3. --list output format is correct
4. --name selection works with valid/invalid names
5. File overwrite confirmation logic

Location: packages/markform/tests/unit/cli/examples.test.ts
