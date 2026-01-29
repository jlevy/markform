---
close_reason: null
closed_at: 2025-12-28T02:32:57.699Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.377Z
    original_id: markform-304
id: is-01kg3x1bv6rdxsgqny21sksh90
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 1.2: Add FrontmatterHarnessConfig type to coreTypes.ts"
type: is
updated_at: 2025-12-28T02:32:57.699Z
version: 1
---
Add harness config type for YAML frontmatter parsing.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 1)

Add to coreTypes.ts:
- FrontmatterHarnessConfig interface with snake_case fields:
  - max_turns?: number
  - max_issues_per_turn?: number
  - max_fields_per_turn?: number
  - max_groups_per_turn?: number
  - max_patches_per_turn?: number

Update FormMetadata interface:
- Add optional harness?: FrontmatterHarnessConfig field

Naming: YAML uses snake_case, TypeScript uses camelCase.
