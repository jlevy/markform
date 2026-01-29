---
close_reason: null
closed_at: 2025-12-28T02:37:33.907Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.572Z
    original_id: markform-311
id: is-01kg3xaa38hsy97ebcsfsphef4
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 4.1: Create initialValues.ts for CLI field input"
type: is
updated_at: 2025-12-28T02:37:33.907Z
version: 1
---
Parse and merge field values from CLI.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 4)

Create src/cli/lib/initialValues.ts:

- parseInlineFieldValues(args: string[]): InputContext
  Parse 'field=value' pairs after -- separator.
  Split on first = only (values can contain =).

- loadInitialValuesFile(path: string): Promise<InputContext>
  Load JSON or YAML file (yaml parser handles both).
  Error on missing file or invalid syntax.

- mergeInitialValues(file: InputContext, inline: InputContext): InputContext
  Merge with inline overriding file values.

Unit tests in tests/unit/cli/initialValues.test.ts.
