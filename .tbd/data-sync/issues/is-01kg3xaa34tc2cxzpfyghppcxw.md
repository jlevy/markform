---
close_reason: null
closed_at: 2025-12-24T17:47:48.823Z
created_at: 2025-12-24T17:30:54.625Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.469Z
    original_id: markform-176
id: is-01kg3xaa34tc2cxzpfyghppcxw
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[172.4] Migrate example .form.md files to new syntax"
type: is
updated_at: 2025-12-24T17:47:48.823Z
version: 1
---
**Parent:** markform-172
**Spec:** docs/project/specs/active/impl-2025-12-24-doc-block-syntax-simplification.md#phase-3

## Files to Migrate (11 total)

### Package examples:
- packages/markform/examples/simple/simple.form.md
- packages/markform/examples/simple/simple-mock-filled.form.md
- packages/markform/examples/political-research/political-research.form.md
- packages/markform/examples/political-research/political-research.mock.lincoln.form.md
- packages/markform/examples/earnings-analysis/earnings-analysis.form.md

### Root-level filled forms:
- political-research-filled1.form.md
- political-research-filled2.form.md
- political-research-filled3.form.md
- simple-filled1.form.md
- simple-filled1-filled.form.md
- simple-filled2.form.md

## Migration Pattern
| Old | New |
|-----|-----|
| `{% doc ref="x" kind="description" %}` | `{% description ref="x" %}` |
| `{% doc ref="x" kind="instructions" %}` | `{% instructions ref="x" %}` |
| `{% /doc %}` | `{% /description %}` or `{% /instructions %}` |

## Special Case
political-research.form.md: The workflow/data sources block should become `{% documentation %}` (not instructions).

## Acceptance
- All files parse without errors
- `pnpm markform inspect <file>` works on all files
