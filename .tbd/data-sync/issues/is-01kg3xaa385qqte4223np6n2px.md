---
close_reason: null
closed_at: 2025-12-28T05:24:01.190Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.604Z
    original_id: markform-317
id: is-01kg3xaa385qqte4223np6n2px
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 6: Update research example forms with best practices"
type: is
updated_at: 2025-12-28T05:24:01.190Z
version: 1
---
Apply research form best practices to examples.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 6)

Forms to update:
- packages/markform/examples/startup-deep-research/startup-deep-research.form.md
- packages/markform/examples/celebrity-deep-research/celebrity-deep-research.form.md

Changes:
1. Frontmatter order: spec, roles, role_instructions, harness
2. Add harness config: max_issues_per_turn: 3, max_groups_per_turn: 1
3. Each field group ends with *_sources URL list field
4. Source field labels are descriptive (not generic)
5. Instructions use 'URLs used as sources' (not 'consulted')
6. Remove redundant all_sources field from metadata section

Note: Some of these changes may already be done - verify current state first.
