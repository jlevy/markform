---
close_reason: null
closed_at: 2025-12-28T02:32:57.812Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.551Z
    original_id: markform-306
id: is-01kg3xaa38gpwpw8ky6t31n8pg
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 1.4: Add harnessConfigResolver.ts"
type: is
updated_at: 2025-12-28T02:32:57.812Z
version: 1
---
Create shared harness config resolution with override hierarchy.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 1)

Create src/cli/lib/harnessConfigResolver.ts:
- FILL_DEFAULTS: { maxTurns: 100, maxIssuesPerTurn: 10, maxPatchesPerTurn: 20 }
- RESEARCH_DEFAULTS: { maxTurns: 100, maxIssuesPerTurn: 3, maxPatchesPerTurn: 20, maxGroupsPerTurn: 1 }
- frontmatterToHarnessConfig(fm): converts snake_case to camelCase
- resolveHarnessConfig(workflow, frontmatter?, cliOptions?): HarnessConfig
  - Merge order: defaults < frontmatter < CLI
  - workflow: 'fill' | 'research' selects defaults

Unit tests for override hierarchy in tests/unit/cli/harnessConfigResolver.test.ts.
